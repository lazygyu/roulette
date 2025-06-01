import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from '@prisma/client';
import { prefixGameRoomId } from '../utils/roomId.util';
import { GameSessionService } from '../game-session.service';
import { GameEngineService } from '../game-engine.service';
import { RoomsService } from '../../rooms/rooms.service';
import { StartGameDto } from '../dto/start-game.dto';
import { ResetGameDto } from '../dto/reset-game.dto';
import { GetGameStateDto } from '../dto/get-game-state.dto';
import { GetMapsDto } from '../dto/get-maps.dto';

@Injectable()
export class GameControlHandler {
  private readonly logger = new Logger(GameControlHandler.name);

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly gameEngineService: GameEngineService,
    private readonly roomsService: RoomsService,
  ) {}

  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartGameDto,
    user: User,
    server: Server,
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 게임을 시작할 수 있습니다.');
    }

    try {
      this.gameSessionService.startGame(roomId);
      server.to(prefixedRoomId).emit('game_started');
      this.gameEngineService.startGameLoop(roomId, server);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 게임 시작 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error starting game in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`게임 시작 중 오류 발생: ${message}`);
    }
  }

  async handleResetGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ResetGameDto,
    user: User,
    server: Server,
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 게임을 리셋할 수 있습니다.');
    }

    try {
      this.gameEngineService.stopGameLoop(roomId);
      this.gameSessionService.resetGame(roomId);

      const gameState = this.gameSessionService.getGameState(roomId);
      server.to(prefixedRoomId).emit('game_reset');
      server.to(prefixedRoomId).emit('game_state', gameState);

      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 게임 리셋 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error resetting game in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`게임 리셋 중 오류 발생: ${message}`);
    }
  }

  handleGetGameState(@ConnectedSocket() client: Socket, @MessageBody() data: GetGameStateDto) {
    const { roomId } = data;
    try {
      const gameState = this.gameSessionService.getGameState(roomId);
      return { success: true, gameState };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting game state for room ${roomId}: ${message}`);
      return { success: false, message: `게임 상태 조회 중 오류 발생: ${message}`, gameState: null };
    }
  }

  handleGetMaps(@ConnectedSocket() client: Socket, @MessageBody() data: GetMapsDto) {
    const { roomId } = data;
    try {
      const maps = this.gameSessionService.getMaps(roomId);
      return { success: true, maps };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting maps for room ${roomId}: ${message}`);
      return { success: false, message: `맵 목록 조회 중 오류 발생: ${message}`, maps: [] };
    }
  }
}
