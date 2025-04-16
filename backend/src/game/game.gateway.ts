import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomManagerService } from './room-manager.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly roomManagerService: RoomManagerService) {}

  afterInit() {
    this.logger.log('Game WebSocket Gateway 초기화 완료');
  }

  handleConnection(client: Socket) {
    this.logger.log(`클라이언트가 연결되었습니다: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결이 끊겼습니다: ${client.id}`);
    // 클라이언트가 참여한 모든 방에서 제거
    const rooms = Array.from(client.rooms.values()).filter((room) => room !== client.id);
    rooms.forEach((roomId) => {
      this.roomManagerService.removePlayer(roomId, client.id);
      // 방에 남아있는 플레이어들에게 알림
      client.to(roomId).emit('player_left', { playerId: client.id });
    });
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    client.join(roomId);
    this.roomManagerService.addPlayer(roomId, client.id);

    // 같은 방에 있는 다른 클라이언트들에게 새로운 플레이어가 들어왔음을 알림
    client.to(roomId).emit('player_joined', { playerId: client.id });

    // 게임 초기 상태 전송
    const gameState = this.roomManagerService.getGameState(roomId);
    const maps = this.roomManagerService.getMaps(roomId);
    client.emit('game_state', gameState);
    client.emit('available_maps', maps);

    this.logger.log(`클라이언트 ${client.id}가 방 ${roomId}에 참여했습니다.`);
    return { success: true, message: `방 ${roomId}에 참여했습니다.` };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    client.leave(roomId);
    this.roomManagerService.removePlayer(roomId, client.id);

    // 같은 방에 있는 다른 클라이언트들에게 플레이어가 나갔음을 알림
    client.to(roomId).emit('player_left', { playerId: client.id });

    this.logger.log(`클라이언트 ${client.id}가 방 ${roomId}에서 나갔습니다.`);
    return { success: true, message: `방 ${roomId}에서 나갔습니다.` };
  }

  @SubscribeMessage('set_marbles')
  handleSetMarbles(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; names: string[] }) {
    const { roomId, names } = data;
    this.roomManagerService.setMarbles(roomId, names);

    // 게임 상태 변경 알림
    const gameState = this.roomManagerService.getGameState(roomId);
    this.server.to(roomId).emit('game_state', gameState);

    this.logger.log(`방 ${roomId}의 마블 설정이 변경되었습니다.`);
    return { success: true };
  }

  @SubscribeMessage('set_winning_rank')
  handleSetWinningRank(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; rank: number }) {
    const { roomId, rank } = data;
    this.roomManagerService.setWinningRank(roomId, rank);

    // 게임 상태 변경 알림
    const gameState = this.roomManagerService.getGameState(roomId);
    this.server.to(roomId).emit('game_state', gameState);

    this.logger.log(`방 ${roomId}의 우승 순위가 ${rank}로 설정되었습니다.`);
    return { success: true };
  }

  @SubscribeMessage('set_map')
  handleSetMap(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; mapIndex: number }) {
    const { roomId, mapIndex } = data;
    this.roomManagerService.setMap(roomId, mapIndex);

    // 게임 상태 변경 알림
    const gameState = this.roomManagerService.getGameState(roomId);
    this.server.to(roomId).emit('game_state', gameState);

    this.logger.log(`방 ${roomId}의 맵이 변경되었습니다.`);
    return { success: true };
  }

  @SubscribeMessage('set_speed')
  handleSetSpeed(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; speed: number }) {
    const { roomId, speed } = data;
    this.roomManagerService.setSpeed(roomId, speed);

    // 게임 상태 변경 알림
    this.server.to(roomId).emit('speed_changed', { speed });

    this.logger.log(`방 ${roomId}의 게임 속도가 ${speed}로 변경되었습니다.`);
    return { success: true };
  }

  @SubscribeMessage('start_game')
  handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    this.roomManagerService.startGame(roomId);

    // 게임 상태 변경 알림
    this.server.to(roomId).emit('game_started');

    // 게임 상태 정기 업데이트 시작
    const room = this.roomManagerService.getRoom(roomId);
    if (room && room.isRunning) {
      const interval = setInterval(() => {
        const gameState = this.roomManagerService.getGameState(roomId);
        if (gameState) {
          this.server.to(roomId).emit('game_state', gameState);

          // 게임이 종료되었다면 정기 업데이트 중지
          if (!gameState.isRunning) {
            clearInterval(interval);
            this.server.to(roomId).emit('game_over', {
              winner: gameState.winner,
            });
          }
        } else {
          clearInterval(interval);
        }
      }, 1000 / 30); // 30fps로 업데이트
    }

    this.logger.log(`방 ${roomId}에서 게임이 시작되었습니다.`);
    return { success: true };
  }

  @SubscribeMessage('reset_game')
  handleResetGame(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    this.roomManagerService.resetGame(roomId);

    // 게임 상태 변경 알림
    const gameState = this.roomManagerService.getGameState(roomId);
    this.server.to(roomId).emit('game_reset');
    this.server.to(roomId).emit('game_state', gameState);

    this.logger.log(`방 ${roomId}의 게임이 리셋되었습니다.`);
    return { success: true };
  }

  @SubscribeMessage('get_game_state')
  handleGetGameState(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    const gameState = this.roomManagerService.getGameState(roomId);
    return { success: true, gameState };
  }

  @SubscribeMessage('get_maps')
  handleGetMaps(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    const maps = this.roomManagerService.getMaps(roomId);
    return { success: true, maps };
  }
}
