import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Roulette } from './roulette';
import { PrismaService } from '../prisma/prisma.service'; // PrismaService 임포트
import { Game, GameStatus, Prisma } from '@prisma/client'; // GameStatus 및 Prisma 임포트
import { stages } from './data/maps'; // stages 임포트 추가
import { Server } from 'socket.io'; // Server 임포트 추가
import { prefixGameRoomId } from './utils/roomId.util'; // prefixGameRoomId 임포트 추가
import { GamePersistenceService } from './game-persistence.service'; // GamePersistenceService 임포트
import { Cron, CronExpression } from '@nestjs/schedule'; // Cron 임포트

// GameRoom 인터페이스 수정: id 타입을 number로 변경하고 interval 제거, players 속성 제거
export interface GameRoom {
  id: number; // 숫자 ID 사용
  game: Roulette;
  isRunning: boolean;
}

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);
  // 내부 rooms Map의 key 타입을 number로 변경
  private rooms: Map<number, GameRoom> = new Map();
  private ioServer: Server; // socket.io Server 인스턴스
  private isGCRunning = false; // GC 동시 실행 방지 플래그

  constructor(
    private prisma: PrismaService, // PrismaService 주입
    private gamePersistenceService: GamePersistenceService, // GamePersistenceService 주입
  ) {}

  setIoServer(server: Server) {
    this.ioServer = server;
  }

  // 방이 메모리에 로드되었는지 확인
  isRoomLoaded(roomId: number): boolean {
    return this.rooms.has(roomId);
  }

  // DB에서 방 정보를 로드하여 메모리에 적재
  async loadRoomFromDB(roomId: number): Promise<GameRoom | null> {
    this.logger.log(`Attempting to load room ${roomId} from DB into memory.`);
    const gameData = await this.gamePersistenceService.loadGameData(roomId);

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
      this._configureRoomFromData(room, gameData);
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

  private _configureRoomFromData(room: GameRoom, gameData: Game) {
    if (gameData.mapIndex !== null && gameData.mapIndex !== undefined) {
      room.game.setMap(gameData.mapIndex);
      this.logger.log(`Room ${room.id}: Map set to index ${gameData.mapIndex} from DB.`);
    }
    if (gameData.marbles && gameData.marbles.length > 0) {
      room.game.setMarbles(gameData.marbles); // setMarbles는 내부적으로 reset을 호출할 수 있으므로 순서 중요
      this.logger.log(`Room ${room.id}: Marbles set from DB: ${gameData.marbles.join(', ')}.`);
    }
    if (gameData.winningRank !== null && gameData.winningRank !== undefined) {
      room.game.setWinningRank(gameData.winningRank);
      this.logger.log(`Room ${room.id}: Winning rank set to ${gameData.winningRank} from DB.`);
    }
    if (gameData.speed !== null && gameData.speed !== undefined) {
      room.game.setSpeed(gameData.speed);
      this.logger.log(`Room ${room.id}: Speed set to ${gameData.speed} from DB.`);
    }

    switch (gameData.status) {
      case GameStatus.IN_PROGRESS:
        room.isRunning = true;
        this.logger.log(`Room ${room.id}: Status set to IN_PROGRESS. isRunning: true.`);
        break;
      case GameStatus.WAITING:
        room.isRunning = false;
        this.logger.log(`Room ${room.id}: Status set to WAITING. isRunning: false.`);
        break;
      case GameStatus.FINISHED:
        room.isRunning = false;
        this.logger.log(`Room ${room.id}: Status set to FINISHED. isRunning: false.`);
        break;
      default:
        room.isRunning = false;
        this.logger.warn(`Room ${room.id}: Unknown game status '${gameData.status}' from DB. Defaulting to WAITING.`);
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
      isRunning: false,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // 방 가져오기: roomId 타입을 number로 변경
  getRoom(roomId: number): GameRoom | undefined {
    return this.rooms.get(roomId);
  }


  // removePlayer 메서드 수정: players Map에서 제거하는 로직 제거, 방 제거 로직은 GameGateway에서 소켓 수 확인 후 호출
  removePlayer(roomId: number, playerId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      // 로직 제거됨
    } else {
       this.logger.warn(`Attempted to remove player from non-existent room: ${roomId}`);
    }
  }

  // 플레이어 퇴장 시 방 정리 로직을 처리합니다.
  async handlePlayerDeparture(roomId: number, server: Server): Promise<void> {
    const prefixedRoomId = prefixGameRoomId(roomId);
    const socketsInRoom = await server.in(prefixedRoomId).fetchSockets();
    const room = this.getRoom(roomId);

    if (room && !room.isRunning) { // 게임이 진행 중이 아닐 때만 (WAITING 상태)
      if (socketsInRoom.length === 0) {
        this.logger.log(`방 ${prefixedRoomId}(${roomId})는 WAITING 상태이며, 남은 플레이어가 없습니다. 방을 제거합니다.`);
        // GameEngineService.stopGameLoop 호출은 GameGateway에서 직접 처리하도록 변경
        this.removeRoom(roomId); // 메모리에서 방 제거
      } else {
        this.logger.log(`방 ${prefixedRoomId}(${roomId})에 ${socketsInRoom.length}명의 플레이어가 남아있습니다.`);
      }
    } else if (room && room.isRunning) { // 게임이 진행 중일 때
      this.logger.log(`방 ${prefixedRoomId}(${roomId})는 게임 진행 중입니다. ${socketsInRoom.length}명의 플레이어가 남아있습니다.`);
    } else { // 방이 메모리에 없는 경우 (이미 정리되었거나, 잘못된 접근)
      this.logger.warn(`방 ${prefixedRoomId}(${roomId})가 메모리에 없습니다. (handlePlayerDeparture)`);
    }
  }

  // 방 삭제: roomId 타입을 number로 변경
  removeRoom(roomId: number): void {
    const room = this.getRoom(roomId);
    if (room) {
      if (room.game && typeof room.game.destroy === 'function') {
        room.game.destroy(); // Destroy Roulette instance and its physics
        this.logger.log(`Room ${roomId}: Roulette game instance destroyed.`);
      }
      // GameEngineService에서 루프를 관리하므로 여기서는 interval 제거 로직 불필요
      this.rooms.delete(roomId);
      this.logger.log(`Room ${roomId} removed from session.`);
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
      this.logger.warn(`Game in room ${roomId} is already IN_PROGRESS.`);
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

    await this.gamePersistenceService.upsertGame(roomId, {
      status: GameStatus.IN_PROGRESS,
      mapIndex: currentMapIndex !== -1 ? currentMapIndex : null,
      marbles: currentGameState.marbles.map((m) => m.name),
      winningRank: currentGameState.winnerRank,
      speed: room.game.getSpeed(),
    });
    // interval 시작 로직은 GameEngineService로 이동됨 (GameGateway에서 호출)
  }

  // 게임 종료 처리: isRunning 상태를 false로 변경, DB 연동 추가
  async endGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (room && room.isRunning) {
      room.isRunning = false; // 메모리 상태 업데이트

      try {
        const updatedGame = await this.gamePersistenceService.updateGameStatus(roomId, GameStatus.FINISHED);
        await this._saveFinalRankings(room, updatedGame.id);
        this.logger.log(`Game in room ${roomId} officially ended and all marbles ranking saved to DB.`);
      } catch (error) {
        this.logger.error(`Failed to update game status to FINISHED or save rankings for room ${roomId}:`, error);
      }
    } else if (room && !room.isRunning) {
      this.logger.warn(`Attempted to end game in room ${roomId} that was not running.`);
    } else {
      // 방이 없는 경우 NotFoundException을 발생시키거나 경고 로그를 남길 수 있습니다.
      // throw new NotFoundException(`Room with ID ${roomId} not found when trying to end game.`);
      this.logger.warn(`Attempted to end game in non-existent room: ${roomId}`);
    }
  }

  private async _saveFinalRankings(room: GameRoom, gameId: number): Promise<void> {
    const allMarblesFinalRanking = room.game.getFinalRankingForAllMarbles();

    if (!allMarblesFinalRanking || allMarblesFinalRanking.length === 0) {
      return;
    }

    const rankingCreateData = allMarblesFinalRanking.map((entry) => {
      const rankToStore = typeof entry.finalRank === 'number' ? entry.finalRank : 9999; // DNF는 큰 수로 저장
      return {
        gameId: gameId,
        marbleName: entry.name,
        rank: rankToStore,
        isWinner: entry.isWinnerGoal,
      };
    });

    await this.gamePersistenceService.saveGameRankings(gameId, rankingCreateData);
  }

  private async _checkGameIsEditable(roomId: number): Promise<void> {
    const gameData = await this.gamePersistenceService.loadGameData(roomId);
    if (gameData && (gameData.status === GameStatus.IN_PROGRESS || gameData.status === GameStatus.FINISHED)) {
      throw new ConflictException(`Game in room ${roomId} is already ${gameData.status}. Cannot change settings.`);
    }
  }

  // 게임 설정 (마블): roomId 타입을 number로 변경, DB 연동 추가
  async setMarbles(roomId: number, names: string[]): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    await this._checkGameIsEditable(roomId);

    // 메모리 내 게임 객체 업데이트
    room.game.setMarbles(names);

    // DB 업데이트 또는 생성
    await this.gamePersistenceService.upsertGame(roomId, {
      marbles: names,
      status: GameStatus.WAITING,
    });
  }

  // 우승 순위 설정: roomId 타입을 number로 변경, DB 연동 추가
  async setWinningRank(roomId: number, rank: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    await this._checkGameIsEditable(roomId);

    // 메모리 내 게임 객체 업데이트
    room.game.setWinningRank(rank);

    // DB 업데이트 또는 생성
    await this.gamePersistenceService.upsertGame(roomId, {
      winningRank: rank,
      status: GameStatus.WAITING,
    });
  }

  // 맵 설정: roomId 타입을 number로 변경, DB 연동 추가
  async setMap(roomId: number, mapIndex: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    await this._checkGameIsEditable(roomId);

    // 메모리 내 게임 객체 업데이트
    room.game.setMap(mapIndex);

    // DB 업데이트 또는 생성
    await this.gamePersistenceService.upsertGame(roomId, {
      mapIndex: mapIndex,
      status: GameStatus.WAITING,
    });
  }

  // 게임 속도 설정: roomId 타입을 number로 변경, DB 연동 추가
  async setSpeed(roomId: number, speed: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    // DB에서 게임 상태 확인 (FINISHED 상태에서는 변경 불가)
    const gameData = await this.gamePersistenceService.loadGameData(roomId);
    if (gameData && gameData.status === GameStatus.FINISHED) {
      throw new ConflictException(`Game in room ${roomId} is already FINISHED. Cannot set speed.`);
    }

    // 메모리 내 게임 객체 업데이트
    room.game.setSpeed(speed);

    // DB 업데이트 또는 생성 (status는 변경하지 않음, WAITING이 기본값)
    await this.gamePersistenceService.upsertGame(roomId, {
      speed: speed,
      status: GameStatus.WAITING,
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

    // 메모리 내 게임 객체 리셋
    room.isRunning = false;
    room.game.reset();

    // DB 업데이트 (status를 WAITING으로), 관련된 GameRanking 삭제
    const gameData = await this.gamePersistenceService.loadGameData(roomId);
    if (gameData) {
      // 게임 데이터가 있을 때만 업데이트
      await this.prisma.$transaction(async () => {
        // 기존 랭킹 정보 삭제
        await this.gamePersistenceService.deleteGameRankings(gameData.id);
        // 게임 상태 업데이트
        await this.gamePersistenceService.updateGameStatus(
          roomId,
          GameStatus.WAITING,
        );
      });
    }
    // 게임 데이터가 없으면 아무것도 안 함 (리셋할 대상이 없음)
  }

  @Cron(CronExpression.EVERY_10_SECONDS) // 10초마다 실행
  async cleanupRooms() {
    if (this.isGCRunning) {
      this.logger.log('GC is already running, skipping this cycle.');
      return;
    }

    if (!this.ioServer) {
      this.logger.warn('Socket.IO Server instance not set in GameSessionService. Skipping GC.');
      return;
    }

    this.isGCRunning = true;
    this.logger.log('Starting periodic room cleanup (GC).');
    let cleanedRoomsCount = 0;

    this.logger.log(`Current active rooms: ${this.rooms.size}`);

    try {
      for (const [roomId, room] of this.rooms.entries()) {
        const prefixedRoomId = prefixGameRoomId(roomId);
        const socketsInRoom = await this.ioServer.in(prefixedRoomId).fetchSockets();

        // 룸이 WAITING 상태이고, 해당 룸에 연결된 소켓이 없는 경우
        if (!room.isRunning && socketsInRoom.length === 0) {
          this.logger.log(`GC: Room ${prefixedRoomId}(${roomId}) is WAITING and has no connected sockets. Removing.`);
          this.removeRoom(roomId);
          cleanedRoomsCount++;
        } else if (room.isRunning) {
          this.logger.log(`GC: Room ${prefixedRoomId}(${roomId}) is IN_PROGRESS. Sockets: ${socketsInRoom.length}.`);
        } else {
          this.logger.log(`GC: Room ${prefixedRoomId}(${roomId}) is WAITING but has ${socketsInRoom.length} connected sockets. Keeping.`);
        }
      }
    } catch (error) {
      this.logger.error(`Error during room cleanup: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isGCRunning = false;
      this.logger.log(`Periodic room cleanup (GC) finished. Cleaned up ${cleanedRoomsCount} rooms.`);
    }
  }
}
