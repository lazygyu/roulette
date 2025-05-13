import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Roulette } from './roulette';
import { PrismaService } from '../prisma/prisma.service'; // PrismaService 임포트
import { GameStatus, Prisma } from '@prisma/client'; // GameStatus 및 Prisma 임포트
import { stages } from './data/maps'; // stages 임포트 추가

// Player 인터페이스는 동일하게 유지
interface Player {
  id: string;
  userInfo: {
    nickname: string;
  };
}

// GameRoom 인터페이스 수정: id 타입을 number로 변경하고 interval 제거
export interface GameRoom {
  id: number; // 숫자 ID 사용
  game: Roulette;
  players: Map<string, Player>; // 플레이어 ID는 여전히 string
  isRunning: boolean;
  // interval?: NodeJS.Timeout; // GameEngineService에서 관리하므로 제거
}

@Injectable()
export class GameSessionService {
  // 내부 rooms Map의 key 타입을 number로 변경
  private rooms: Map<number, GameRoom> = new Map();

  constructor(private prisma: PrismaService) {} // PrismaService 주입

  // 방 생성: roomId 타입을 number로 변경
  createRoom(roomId: number): GameRoom {
    if (this.rooms.has(roomId)) {
      // 이미 존재하는 방이면 반환 (혹은 에러 처리)
      // 여기서는 기존 방을 반환하는 것으로 유지
      return this.rooms.get(roomId)!;
    }

    const game = new Roulette();
    const room: GameRoom = {
      id: roomId, // 숫자 ID 사용
      game,
      players: new Map(),
      isRunning: false,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // 방 가져오기: roomId 타입을 number로 변경
  getRoom(roomId: number): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // 방에 플레이어 추가: roomId 타입을 number로 변경
  addPlayer(roomId: number, playerId: string, userInfo: { nickname: string }): void {
    let room = this.getRoom(roomId);
    if (!room) {
      // 방이 없으면 새로 생성 (혹은 에러 처리 - 여기서는 생성)
      room = this.createRoom(roomId);
    }

    room.players.set(playerId, {
      id: playerId,
      userInfo: userInfo,
    });
  }

  // 방에서 플레이어 제거: roomId 타입을 number로 변경
  removePlayer(roomId: number, playerId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      const deleted = room.players.delete(playerId);
      if (deleted && room.players.size === 0) {
        // 플레이어가 없고 성공적으로 삭제되었다면 방 제거
        this.removeRoom(roomId);
      }
    } else {
       // 방이 존재하지 않는 경우 로그 또는 에러 처리
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

  // 플레이어 목록 가져오기: roomId 타입을 number로 변경
  getPlayers(roomId: number): Player[] {
    const room = this.getRoom(roomId);
    return room ? Array.from(room.players.values()) : [];
  }
}
