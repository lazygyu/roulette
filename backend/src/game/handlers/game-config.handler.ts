import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from '@prisma/client';
import { prefixGameRoomId } from '../utils/roomId.util';
import { GameSessionService } from '../game-session.service';
import { RoomsService } from '../../rooms/rooms.service';
import { ManagerOnlyGuard } from '../guards';
import { SetMarblesDto } from '../dto/set-marbles.dto';
import { SetWinningRankDto } from '../dto/set-winning-rank.dto';
import { SetMapDto } from '../dto/set-map.dto';
import { SetSpeedDto } from '../dto/set-speed.dto';

@Injectable()
export class GameConfigHandler {
  private readonly logger = new Logger(GameConfigHandler.name);

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly roomsService: RoomsService,
  ) {}

  @UseGuards(ManagerOnlyGuard)
  async handleSetMarbles(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMarblesDto,
    user: User,
    server: Server,
  ) {
    const { roomId, names } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // const isManager = await this.roomsService.isManager(roomId, user.id);
    // if (!isManager) {
    //   throw new WsException('방의 매니저만 마블을 설정할 수 있습니다.');
    // }

    try {
      await this.gameSessionService.setMarbles(roomId, names);
      const gameState = this.gameSessionService.getGameState(roomId);
      server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 마블 설정 변경 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      // GlobalWsExceptionFilter가 로깅 및 WsException 처리를 담당
      const message = error instanceof Error ? error.message : String(error);
      throw new WsException(message || '마블 설정 중 오류 발생');
    }
  }

  @UseGuards(ManagerOnlyGuard)
  async handleSetWinningRank(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetWinningRankDto,
    user: User,
    server: Server,
  ) {
    const { roomId, rank } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // const isManager = await this.roomsService.isManager(roomId, user.id);
    // if (!isManager) {
    //   throw new WsException('방의 매니저만 우승 순위를 설정할 수 있습니다.');
    // }

    try {
      this.gameSessionService.setWinningRank(roomId, rank);
      const gameState = this.gameSessionService.getGameState(roomId);
      server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 우승 순위 ${rank}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WsException(message || '우승 순위 설정 중 오류 발생');
    }
  }

  @UseGuards(ManagerOnlyGuard)
  async handleSetMap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMapDto,
    user: User,
    server: Server,
  ) {
    const { roomId, mapIndex } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // const isManager = await this.roomsService.isManager(roomId, user.id);
    // if (!isManager) {
    //   throw new WsException('방의 매니저만 맵을 설정할 수 있습니다.');
    // }

    try {
      await this.gameSessionService.setMap(roomId, mapIndex);
      const gameState = this.gameSessionService.getGameState(roomId);
      server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 맵 ${mapIndex}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WsException(message || '맵 설정 중 오류 발생');
    }
  }

  @UseGuards(ManagerOnlyGuard)
  async handleSetSpeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetSpeedDto,
    user: User,
    server: Server,
  ) {
    const { roomId, speed } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // const isManager = await this.roomsService.isManager(roomId, user.id);
    // if (!isManager) {
    //   throw new WsException('방의 매니저만 속도를 설정할 수 있습니다.');
    // }

    try {
      this.gameSessionService.setSpeed(roomId, speed);
      server.to(prefixedRoomId).emit('speed_changed', { speed });
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 속도 ${speed}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WsException(message || '속도 설정 중 오류 발생');
    }
  }
}
