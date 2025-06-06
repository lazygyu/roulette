import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Roulette } from './roulette';
import { GameStatus, Prisma } from '@prisma/client';
import { Server } from 'socket.io';
import { prefixGameRoomId } from './utils/roomId.util';
import { GamePersistenceService } from './game-persistence.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameRoom } from './game-room';

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);
  private rooms: Map<number, GameRoom> = new Map();
  private ioServer: Server;
  private isGCRunning = false;

  constructor(private gamePersistenceService: GamePersistenceService) {}

  setIoServer(server: Server) {
    this.ioServer = server;
  }

  isRoomLoaded(roomId: number): boolean {
    return this.rooms.has(roomId);
  }

  async loadRoomFromDB(roomId: number): Promise<GameRoom | null> {
    this.logger.log(`Attempting to load room ${roomId} from DB into memory.`);
    const gameData = await this.gamePersistenceService.loadGameData(roomId);

    if (!gameData) {
      this.logger.warn(`Game data for room ${roomId} not found in DB.`);
      const newRoom = await this.createRoom(roomId);
      this.logger.log(`No game data in DB for room ${roomId}. Created a new default game session in memory.`);
      return newRoom;
    }

    this.logger.log(`Game data found for room ${roomId} in DB. Status: ${gameData.status}`);
    const room = await this.createRoom(roomId);

    try {
      room.configureFromData(gameData);
      this.logger.log(`Room ${roomId} successfully loaded from DB and configured in memory.`);
      return room;
    } catch (error) {
      this.logger.error(`Error configuring game room ${roomId} from DB data: ${error instanceof Error ? error.message : String(error)}`);
      this.removeRoom(roomId);
      throw new InternalServerErrorException(`Failed to configure game room ${roomId} from database.`);
    }
  }

  async createRoom(roomId: number): Promise<GameRoom> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const game = await Roulette.createInstance();
    const room = new GameRoom(roomId, game);

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: number): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  removePlayer(roomId: number, playerId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      // Logic removed
    } else {
      this.logger.warn(`Attempted to remove player from non-existent room: ${roomId}`);
    }
  }

  async handlePlayerDeparture(roomId: number, server: Server): Promise<void> {
    const prefixedRoomId = prefixGameRoomId(roomId);
    const socketsInRoom = await server.in(prefixedRoomId).fetchSockets();
    const room = this.getRoom(roomId);

    if (room && !room.isRunning) {
      if (socketsInRoom.length === 0) {
        this.logger.log(`Room ${prefixedRoomId}(${roomId}) is WAITING and has no players left. Removing room.`);
        this.removeRoom(roomId);
      } else {
        this.logger.log(`Room ${prefixedRoomId}(${roomId}) has ${socketsInRoom.length} players remaining.`);
      }
    } else if (room && room.isRunning) {
      this.logger.log(`Room ${prefixedRoomId}(${roomId}) is IN_PROGRESS. ${socketsInRoom.length} players remaining.`);
    } else {
      this.logger.warn(`Room ${prefixedRoomId}(${roomId}) not found in memory. (handlePlayerDeparture)`);
    }
  }

  removeRoom(roomId: number): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.destroy();
      this.rooms.delete(roomId);
      this.logger.log(`Room ${roomId} removed from session.`);
    }
  }

  async startGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    const gameData = await this.gamePersistenceService.loadGameData(roomId);
    if (gameData && gameData.status === GameStatus.FINISHED) {
      throw new ConflictException(`Game in room ${roomId} is already FINISHED. Cannot start again.`);
    }
    if (gameData && gameData.status === GameStatus.IN_PROGRESS) {
      this.logger.warn(`Game in room ${roomId} is already IN_PROGRESS.`);
      if (!room.isRunning) {
        room.isRunning = true;
      }
      return;
    }

    room.isRunning = true;
    room.game.start();

    const currentGameState = room.game.getGameState();
    const currentMapIndex = room.game.currentMapIndex;

    await this.gamePersistenceService.upsertGame(roomId, {
      status: GameStatus.IN_PROGRESS,
      mapIndex: currentMapIndex !== -1 ? currentMapIndex : null,
      marbles: currentGameState.marbles.map((m) => m.name),
      winningRank: currentGameState.winnerRank,
      speed: room.game.getSpeed(),
    });
  }

  async endGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (room && room.isRunning) {
      room.isRunning = false;

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
      this.logger.warn(`Attempted to end game in non-existent room: ${roomId}`);
    }
  }

  private async _saveFinalRankings(room: GameRoom, gameId: number): Promise<void> {
    const allMarblesFinalRanking = room.game.getFinalRankingForAllMarbles();

    if (!allMarblesFinalRanking || allMarblesFinalRanking.length === 0) {
      return;
    }

    const rankingCreateData = allMarblesFinalRanking.map((entry) => {
      const rankToStore = typeof entry.finalRank === 'number' ? entry.finalRank : 9999;
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

  async setMarbles(roomId: number, names: string[]): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) throw new NotFoundException(`Room with ID ${roomId} not found.`);
    await this._checkGameIsEditable(roomId);
    room.game.setMarbles(names);
    await this.gamePersistenceService.upsertGame(roomId, {
      marbles: names,
      status: GameStatus.WAITING,
    });
  }

  async setWinningRank(roomId: number, rank: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) throw new NotFoundException(`Room with ID ${roomId} not found.`);
    await this._checkGameIsEditable(roomId);
    room.game.setWinningRank(rank);
    await this.gamePersistenceService.upsertGame(roomId, {
      winningRank: rank,
      status: GameStatus.WAITING,
    });
  }

  async setMap(roomId: number, mapIndex: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) throw new NotFoundException(`Room with ID ${roomId} not found.`);
    await this._checkGameIsEditable(roomId);
    room.game.setMap(mapIndex);
    await this.gamePersistenceService.upsertGame(roomId, {
      mapIndex: mapIndex,
      status: GameStatus.WAITING,
    });
  }

  async setSpeed(roomId: number, speed: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) throw new NotFoundException(`Room with ID ${roomId} not found.`);
    const gameData = await this.gamePersistenceService.loadGameData(roomId);
    if (gameData && gameData.status === GameStatus.FINISHED) {
      throw new ConflictException(`Game in room ${roomId} is already FINISHED. Cannot set speed.`);
    }
    room.game.setSpeed(speed);
    await this.gamePersistenceService.upsertGame(roomId, {
      speed: speed,
      status: GameStatus.WAITING,
    });
  }

  getGameState(roomId: number) {
    const room = this.getRoom(roomId);
    return room ? room.game.getGameState() : null;
  }

  getMaps(roomId: number) {
    const room = this.getRoom(roomId);
    return room ? room.game.getMaps() : [];
  }

  async resetGame(roomId: number): Promise<void> {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }

    room.isRunning = false;
    room.game.reset();

    const gameData = await this.gamePersistenceService.loadGameData(roomId);
    if (gameData) {
      await this.gamePersistenceService.deleteGameRankings(gameData.id);
      await this.gamePersistenceService.updateGameStatus(roomId, GameStatus.WAITING);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
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
