import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Roulette } from './roulette';
import { PrismaService } from '../prisma/prisma.service'; // PrismaService 임포트
import { Game, GameStatus, Prisma } from '@prisma/client'; // GameStatus 및 Prisma 임포트
import { stages } from './data/maps'; // stages 임포트 추가

// GameRoom 인터페이스 수정: id 타입을 number로 변경하고 interval 제거, players 속성 제거
export interface GameRoom {
  id: number; // 숫자 ID 사용
  game: Roulette;
  // players: Map<string, Player>; // 제거
  isRunning: boolean;
}

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);
  // 내부 rooms Map의 key 타입을 number로 변경
  private rooms: Map<number, GameRoom> = new Map();

  constructor(private prisma: PrismaService) {} // PrismaService 주입

  // 방이 메모리에 로드되었는지 확인
  isRoomLoaded(roomId: number): boolean {
    return this.rooms.has(roomId);
  }

  // DB에서 방 정보를 로드하여 메모리에 적재
  async loadRoomFromDB(roomId: number): Promise<GameRoom | null> {
    this.logger.log(`Attempting to load room ${roomId} from DB into memory.`);
    const gameData = await this.prisma.game.findUnique({
      where: { roomId },
      // include: { rankings: true }, // FINISHED 상태일 때 랭킹 정보 로드 (필요시 주석 해제)
    });

    if (!gameData) {
      this.logger.warn(`Game data for room ${roomId} not found in DB.`);
      // 방은 존재하지만 게임 데이터가 없는 경우, WAITING 상태로 새로 생성될 수 있도록 null 대신 빈 방을 만들 수도 있음.
      // 여기서는 일단 null을 반환하거나, 혹은 createRoom을 호출하여 기본 방을 만들도록 할 수 있음.
      // 현재 로직상으로는 GameGateway에서 room 존재 여부를 먼저 체크하므로, gameData가 없는 경우는
      // 아직 게임이 시작되지 않았거나, DB에 game 레코드가 없는 상태로 간주.
      // 이 경우, createRoom을 통해 새로운 GameRoom 인스턴스를 만들고 기본값으로 초기화.
      const newRoom = await this.createRoom(roomId); // await 추가
      this.logger.log(`No game data in DB for room ${roomId}. Created a new default game session in memory.`);
      return newRoom;
    }

    this.logger.log(`Game data found for room ${roomId} in DB. Status: ${gameData.status}`);
    // 방이 메모리에 없다면 생성, 있다면 가져오기 (보통은 isRoomLoaded 체크 후 호출되므로 새로 생성됨)
    const room = await this.createRoom(roomId); // await 추가

    try {
      // DB 데이터로 게임 상태 설정
      if (gameData.mapIndex !== null && gameData.mapIndex !== undefined) {
        room.game.setMap(gameData.mapIndex);
        this.logger.log(`Room ${roomId}: Map set to index ${gameData.mapIndex} from DB.`);
      }
      if (gameData.marbles && gameData.marbles.length > 0) {
        room.game.setMarbles(gameData.marbles); // setMarbles는 내부적으로 reset을 호출할 수 있으므로 순서 중요
        this.logger.log(`Room ${roomId}: Marbles set from DB: ${gameData.marbles.join(', ')}.`);
      }
      if (gameData.winningRank !== null && gameData.winningRank !== undefined) {
        room.game.setWinningRank(gameData.winningRank);
        this.logger.log(`Room ${roomId}: Winning rank set to ${gameData.winningRank} from DB.`);
      }
      if (gameData.speed !== null && gameData.speed !== undefined) {
        room.game.setSpeed(gameData.speed);
        this.logger.log(`Room ${roomId}: Speed set to ${gameData.speed} from DB.`);
      }

      switch (gameData.status) {
        case GameStatus.IN_PROGRESS:
          room.isRunning = true;
          // room.game.start(); // IN_PROGRESS 상태일 때 게임을 '시작' 상태로 만듦.
                             // roulette.ts의 start()는 현재 상태를 초기화하지 않고, isActive 플래그와 물리엔진을 활성화.
                             // 만약 마블 위치 등 더 상세한 상태 복원이 필요하면 roulette.ts 수정 필요.
                             // 현재는 설정만 로드하고, 실제 게임 루프는 GameEngineService에서 관리.
          this.logger.log(`Room ${roomId}: Status set to IN_PROGRESS. isRunning: true.`);
          break;
        case GameStatus.WAITING:
          room.isRunning = false;
          this.logger.log(`Room ${roomId}: Status set to WAITING. isRunning: false.`);
          break;
        case GameStatus.FINISHED:
          room.isRunning = false;
          // TODO: FINISHED 상태일 때, gameData.rankings (주석 해제 시)를 사용하여
          // room.game 객체에 최종 랭킹 정보를 설정하거나, getFinalRankingForAllMarbles가 이를 활용하도록.
          // 예: room.game.setFinalRankings(gameData.rankings);
          this.logger.log(`Room ${roomId}: Status set to FINISHED. isRunning: false.`);
          break;
        default:
          room.isRunning = false;
          this.logger.warn(`Room ${roomId}: Unknown game status '${gameData.status}' from DB. Defaulting to WAITING.`);
      }
      this.logger.log(`Room ${roomId} successfully loaded from DB and configured in memory.`);
      return room;
    } catch (error) {
      this.logger.error(`Error configuring game room ${roomId} from DB data: ${error instanceof Error ? error.message : String(error)}`);
      // 설정 중 에러 발생 시, 메모리에서 해당 방을 제거하거나, 기본 상태로 둘 수 있음.
      // 여기서는 일단 null을 반환하여 게이트웨이에서 처리하도록 함.
      this.removeRoom(roomId); // 설정 실패 시 메모리에서 방 제거
      throw new InternalServerErrorException(`Failed to configure game room ${roomId} from database.`);
    }
  }

  // 방 생성: roomId 타입을 number로 변경, async 및 Promise<GameRoom>으로 변경
  async createRoom(roomId: number): Promise<GameRoom> {
    if (this.rooms.has(roomId)) {
      // 이미 존재하는 방이면 반환 (혹은 에러 처리)
      // 여기서는 기존 방을 반환하는 것으로 유지
      return this.rooms.get(roomId)!;
    }

    const game = await Roulette.createInstance(); // Roulette.createInstance() 사용 및 await
    const room: GameRoom = {
      id: roomId, // 숫자 ID 사용
      game,
      // players: new Map(), // 제거
      isRunning: false,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // 방 가져오기: roomId 타입을 number로 변경
  getRoom(roomId: number): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // 방에 플레이어 추가: roomId 타입을 number로 변경, async 추가
  async addPlayer(
    roomId: number,
    playerId: string,
    userInfo: { id: number | string; nickname: string; isAnonymous: boolean },
  ): Promise<void> {
    let room = this.getRoom(roomId);
    if (!room) {
      // 방이 없으면 새로 생성 (혹은 에러 처리 - 여기서는 생성)
      room = await this.createRoom(roomId); // await 추가
    }

    // room.players.set(playerId, { id: playerId, userInfo: userInfo }); // 제거
    // 플레이어 정보는 소켓에 저장되고, 소켓이 방에 join하는 것으로 충분
  }

  // removePlayer 메서드 수정: players Map에서 제거하는 로직 제거, 방 제거 로직은 GameGateway에서 소켓 수 확인 후 호출
  removePlayer(roomId: number, playerId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      // room.players.delete(playerId); // 제거
      // if (room.players.size === 0) { // 제거
      //   this.removeRoom(roomId); // GameGateway에서 소켓 수 확인 후 호출
      // }
    } else {
       console.warn(`Attempted to remove player from non-existent room: ${roomId}`);
    }
  }

  // 방 삭제: roomId 타입을 number로 변경
  removeRoom(roomId: number): void {
    const room = this.getRoom(roomId);
    if (room) {
      // GameEngineService에서 루프를 관리하므로 여기서는 interval 제거 로직 불필요
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} removed.`);
    }
  }

  // 게임 시작: roomId 타입을 number로 변경, DB 연동 추가
  async startGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인
    const gameData = await this.prisma.game.findUnique({ where: { roomId } });
    if (gameData && gameData.status === GameStatus.FINISHED) {
      throw new ConflictException(`Game in room ${roomId} is already FINISHED. Cannot start again.`);
    }
    if (gameData && gameData.status === GameStatus.IN_PROGRESS) {
      // 기존 로직 유지: 이미 실행 중이면 경고만 하고 종료 (room.isRunning으로도 체크됨)
      console.warn(`Game in room ${roomId} is already IN_PROGRESS.`);
      if (!room.isRunning) { // DB는 IN_PROGRESS인데 메모리는 아닐 경우 동기화
        room.isRunning = true;
      }
      return;
    }

    // 메모리 내 게임 시작
    room.isRunning = true;
    room.game.start();

    // DB 업데이트 또는 생성 (status를 IN_PROGRESS로)
    // 현재 게임 설정을 DB에 반영
    const currentGameState = room.game.getGameState(); // 시작 시점의 설정 가져오기
    const currentMapIndex = room.game.currentMapIndex; // getter 사용

    await this.prisma.game.upsert({
      where: { roomId },
      update: {
        status: GameStatus.IN_PROGRESS,
        mapIndex: currentMapIndex !== -1 ? currentMapIndex : null, // 현재 맵 인덱스 사용
        marbles: currentGameState.marbles.map(m => m.name), // 현재 마블 이름 목록
        winningRank: currentGameState.winnerRank,
        speed: room.game.getSpeed(),
      },
      create: {
        roomId,
        status: GameStatus.IN_PROGRESS,
        mapIndex: currentMapIndex !== -1 ? currentMapIndex : null, // 현재 맵 인덱스 사용
        marbles: currentGameState.marbles.map(m => m.name),
        winningRank: currentGameState.winnerRank,
        speed: room.game.getSpeed(),
      },
    });
    // interval 시작 로직은 GameEngineService로 이동됨 (GameGateway에서 호출)
  }

  // 게임 종료 처리: isRunning 상태를 false로 변경, DB 연동 추가
  async endGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (room && room.isRunning) {
      room.isRunning = false; // 메모리 상태 업데이트

      // 최종 게임 상태 가져오기 (roulette.ts에서 모든 마블의 최종 순위 정보를 가져오도록 수정)
      // const finalGameState = room.game.getGameState(); // 기존 방식
      // const winningRank = finalGameState.winnerRank ?? 1; // 설정된 우승 순위, 없으면 1등

      // DB 업데이트 (status를 FINISHED로)
      try {
        const updatedGame = await this.prisma.game.update({
          where: { roomId },
          data: {
            status: GameStatus.FINISHED,
          },
        });

        // Roulette 클래스에서 모든 마블의 최종 랭킹 정보 가져오기
        const allMarblesFinalRanking = room.game.getFinalRankingForAllMarbles();

        if (allMarblesFinalRanking && allMarblesFinalRanking.length > 0) {
          const rankingCreateData = allMarblesFinalRanking.map(entry => {
            // entry.finalRank가 숫자일 수도 있고, 'DNF' 같은 문자열일 수도 있음.
            // GameRanking 테이블의 rank 컬럼은 Int이므로, 문자열인 경우 적절히 변환하거나
            // DNF를 나타내는 매우 큰 숫자로 저장할 수 있음. 여기서는 일단 숫자로 가정.
            // isWinnerGoal은 roulette.ts에서 이미 계산된 값 (설정된 winningRank와 일치 여부)
            let rankToStore: number;
            if (typeof entry.finalRank === 'number') {
              rankToStore = entry.finalRank;
            } else {
              // 'DNF' 또는 기타 문자열 순위 처리
              // 예: 매우 큰 숫자로 저장하여 DNF를 나타냄
              rankToStore = 9999; // DNF를 나타내는 임의의 큰 수
            }

            return {
              gameId: updatedGame.id,
              marbleName: entry.name,
              rank: rankToStore,
              isWinner: entry.isWinnerGoal, // roulette.ts에서 계산된 isWinnerGoal 사용
            };
          });

          await this.prisma.gameRanking.createMany({
            data: rankingCreateData,
            skipDuplicates: true, // 혹시 모를 중복 방지 (gameId, marbleName 복합키가 있다면)
          });
        }
        console.log(`Game in room ${roomId} officially ended and all marbles ranking saved to DB.`);
      } catch (error) {
        console.error(`Failed to update game status to FINISHED or save all marbles ranking for room ${roomId}:`, error);
        // 에러 처리 (예: 로깅, 재시도 로직 등)
      }

    } else if (room && !room.isRunning) {
      console.warn(`Attempted to end game in room ${roomId} that was not running.`);
    } else {
      // 방이 없는 경우 NotFoundException을 발생시키거나 경고 로그를 남길 수 있습니다.
      // throw new NotFoundException(`Room with ID ${roomId} not found when trying to end game.`);
      console.warn(`Attempted to end game in non-existent room: ${roomId}`);
    }
  }

  // 게임 설정 (마블): roomId 타입을 number로 변경, DB 연동 추가
  async setMarbles(roomId: number, names: string[]): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인
    const gameData = await this.prisma.game.findUnique({ where: { roomId } });
    if (gameData && (gameData.status === GameStatus.IN_PROGRESS || gameData.status === GameStatus.FINISHED)) {
      throw new ConflictException(`Game in room ${roomId} is already ${gameData.status}. Cannot set marbles.`);
    }

    // 메모리 내 게임 객체 업데이트
    room.game.setMarbles(names);

    // DB 업데이트 또는 생성
    await this.prisma.game.upsert({
      where: { roomId },
      update: { marbles: names, status: GameStatus.WAITING },
      create: { roomId, marbles: names, status: GameStatus.WAITING },
    });
  }

  // 우승 순위 설정: roomId 타입을 number로 변경, DB 연동 추가
  async setWinningRank(roomId: number, rank: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인
    const gameData = await this.prisma.game.findUnique({ where: { roomId } });
    if (gameData && (gameData.status === GameStatus.IN_PROGRESS || gameData.status === GameStatus.FINISHED)) {
      throw new ConflictException(`Game in room ${roomId} is already ${gameData.status}. Cannot set winning rank.`);
    }

    // 메모리 내 게임 객체 업데이트
    room.game.setWinningRank(rank);

    // DB 업데이트 또는 생성
    await this.prisma.game.upsert({
      where: { roomId },
      update: { winningRank: rank, status: GameStatus.WAITING },
      create: { roomId, winningRank: rank, status: GameStatus.WAITING },
    });
  }

  // 맵 설정: roomId 타입을 number로 변경, DB 연동 추가
  async setMap(roomId: number, mapIndex: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인
    const gameData = await this.prisma.game.findUnique({ where: { roomId } });
    if (gameData && (gameData.status === GameStatus.IN_PROGRESS || gameData.status === GameStatus.FINISHED)) {
      throw new ConflictException(`Game in room ${roomId} is already ${gameData.status}. Cannot set map.`);
    }

    // 메모리 내 게임 객체 업데이트
    room.game.setMap(mapIndex);

    // DB 업데이트 또는 생성
    await this.prisma.game.upsert({
      where: { roomId },
      update: { mapIndex: mapIndex, status: GameStatus.WAITING },
      create: { roomId, mapIndex: mapIndex, status: GameStatus.WAITING },
    });
  }

  // 게임 속도 설정: roomId 타입을 number로 변경, DB 연동 추가
  async setSpeed(roomId: number, speed: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인 (FINISHED 상태에서는 변경 불가)
    const gameData = await this.prisma.game.findUnique({ where: { roomId } });
    if (gameData && gameData.status === GameStatus.FINISHED) {
      throw new ConflictException(`Game in room ${roomId} is already FINISHED. Cannot set speed.`);
    }

    // 메모리 내 게임 객체 업데이트
    room.game.setSpeed(speed);

    // DB 업데이트 또는 생성 (status는 변경하지 않음, WAITING이 기본값)
    await this.prisma.game.upsert({
      where: { roomId },
      update: { speed: speed },
      create: { roomId, speed: speed, status: GameStatus.WAITING }, // 생성 시 WAITING
    });
  }

  // 게임 상태 가져오기: roomId 타입을 number로 변경
  getGameState(roomId: number) {
    const room = this.getRoom(roomId);
    // 방이 없거나 게임 상태가 없으면 null 반환
    return room ? room.game.getGameState() : null;
  }

  // 사용 가능한 맵 목록 가져오기: roomId 타입을 number로 변경
  getMaps(roomId: number) {
    const room = this.getRoom(roomId);
    // 방이 없으면 빈 배열 반환
    return room ? room.game.getMaps() : [];
  }

  // 게임 리셋: roomId 타입을 number로 변경, DB 연동 추가
  async resetGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인 (FINISHED 상태에서는 리셋 불가?) - 요구사항에 따라 결정
    const gameData = await this.prisma.game.findUnique({ where: { roomId } });
    // if (gameData && gameData.status === GameStatus.FINISHED) {
    //   throw new ConflictException(`Game in room ${roomId} is already FINISHED. Cannot reset.`);
    // }

    // 메모리 내 게임 객체 리셋
    room.isRunning = false;
    room.game.reset();

    // DB 업데이트 (status를 WAITING으로), 관련된 GameRanking 삭제
    if (gameData) { // 게임 데이터가 있을 때만 업데이트
      await this.prisma.$transaction(async (tx) => {
        // 기존 랭킹 정보 삭제
        await tx.gameRanking.deleteMany({
          where: { gameId: gameData.id },
        });
        // 게임 상태 업데이트
        await tx.game.update({
          where: { roomId },
          data: { 
            status: GameStatus.WAITING,
            // ranking 필드는 이미 제거됨
          },
        });
      });
    }
    // 게임 데이터가 없으면 아무것도 안 함 (리셋할 대상이 없음)
  }

  // getPlayers 메서드 제거
  // getPlayers(roomId: number): Player[] {
  //   const room = this.getRoom(roomId);
  //   return room ? Array.from(room.players.values()) : [];
  // }
}
