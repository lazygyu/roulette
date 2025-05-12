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
import { GameEngineService } from './game-engine.service'; // GameEngineService 임포트
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateAnonymousNickname } from './utils/nickname.util'; // 닉네임 유틸리티 임포트
import { prefixRoomId, unprefixRoomId } from './utils/roomId.util'; // Room ID 유틸리티 임포트

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

  constructor(
    private readonly roomManagerService: RoomManagerService,
    private readonly gameEngineService: GameEngineService, // GameEngineService 주입
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('Game WebSocket Gateway 초기화 완료');
  }

  handleConnection(client: Socket) {
    this.logger.log(`새로운 클라이언트 연결: ${client.id} (${new Date().toLocaleString()})`);
  }

  // 연결 종료 처리 (수정 완료된 버전)
  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 종료: ${client.id} (${new Date().toLocaleString()})`);
    const joinedRoomIds = Array.from(client.rooms.values()).filter((room) => room !== client.id);

    joinedRoomIds.forEach((roomId) => {
      try {
        const players = this.roomManagerService.getPlayers(roomId);
        const player = players.find(p => p.id === client.id);
        this.roomManagerService.removePlayer(roomId, client.id);

        client.to(roomId).emit('player_left', {
          playerId: client.id,
          nickname: player?.userInfo.nickname || generateAnonymousNickname(client.id),
        });
        this.logger.log(`방 ${roomId}에서 플레이어 ${player?.userInfo.nickname || '익명'} (${client.id}) 퇴장`);

        if (this.gameEngineService.isLoopRunning(roomId)) {
           this.logger.log(`Player left room ${roomId} while game loop was running.`);
           // 필요시 추가 로직 (예: 마지막 플레이어면 루프 중지)
           // const remainingPlayers = this.roomManagerService.getPlayers(roomId);
           // if (remainingPlayers.length === 0) {
           //   this.gameEngineService.stopGameLoop(roomId);
           // }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error handling disconnect for client ${client.id} in room ${roomId}: ${errorMessage}`);
      }
    });
  }

  // 방 참여 처리 (수정된 버전)
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userInfo?: { nickname: string } }, // roomId는 접두사가 붙은 형태 (e.g., "ROOM_123")
  ) {
    const { roomId } = data;
    const finalUserInfo = data.userInfo || { nickname: generateAnonymousNickname(client.id) };

    let numericRoomId: number;
    try {
      numericRoomId = unprefixRoomId(roomId); // 접두사 제거
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid room ID format.';
      this.logger.warn(`잘못된 형식의 방 ID(${roomId})로 참여 시도: ${client.id} - ${message}`);
      return { success: false, message };
    }

    // DB에서 방 확인 (숫자 ID 사용)
    const roomExists = await this.prisma.room.findUnique({
      where: { id: numericRoomId },
      select: { id: true }, // ID만 선택하여 효율 증대
    });

    if (!roomExists) {
      this.logger.warn(`존재하지 않는 방(ID: ${numericRoomId}) 접근 시도: ${roomId} (${client.id})`);
      return {
        success: false,
        message: `존재하지 않는 방입니다: ${roomId}`,
      };
    }

    // Socket.IO 룸 참여 (접두사 ID 사용)
    client.join(roomId);

    // RoomManagerService에 플레이어 추가 (접두사 ID 사용)
    this.roomManagerService.addPlayer(roomId, client.id, finalUserInfo);

    // 로깅
    const currentPlayers = this.roomManagerService.getPlayers(roomId);
    this.logger.log(`방 ${roomId} 현재 플레이어 목록 (${currentPlayers.length}명):`);
    currentPlayers.forEach((p) => this.logger.log(`- ${p.userInfo.nickname} (${p.id})`));

    // 다른 클라이언트에게 알림
    client.to(roomId).emit('player_joined', {
      playerId: client.id,
      userInfo: finalUserInfo,
    });

    // 참여자에게 게임 상태 및 맵 정보 전송
    const gameState = this.roomManagerService.getGameState(roomId);
    const maps = this.roomManagerService.getMaps(roomId);
    client.emit('game_state', gameState);
    client.emit('available_maps', maps);

    this.logger.log(
      `새로운 플레이어 참여: ${finalUserInfo.nickname} (${client.id}) - 방 ${roomId} (${new Date().toLocaleString()})`,
    );
    return { success: true, message: `방 ${roomId}에 참여했습니다.` };
  }

  // 방 나가기 처리 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    try {
      // 플레이어 정보 가져오기 (닉네임 로깅용)
      const players = this.roomManagerService.getPlayers(roomId);
      const player = players.find(p => p.id === client.id);
      const nickname = player?.userInfo.nickname || generateAnonymousNickname(client.id);

      client.leave(roomId);
      this.roomManagerService.removePlayer(roomId, client.id);

      // 다른 클라이언트에게 알림
      client.to(roomId).emit('player_left', {
        playerId: client.id,
        nickname: nickname, // 퇴장 시에도 닉네임 정보 포함
      });

      this.logger.log(`클라이언트 ${nickname} (${client.id})가 방 ${roomId}에서 나갔습니다.`);

      // 게임 루프 관련 처리 (disconnect와 유사하게 필요시 추가)
      if (this.gameEngineService.isLoopRunning(roomId)) {
        this.logger.log(`Player left room ${roomId} while game loop was running.`);
      }

      return { success: true, message: `방 ${roomId}에서 나갔습니다.` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error leaving room ${roomId} for client ${client.id}: ${message}`);
      return { success: false, message: `방 나가기 처리 중 오류 발생: ${message}` };
    }
  }

  // 마블 설정 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('set_marbles')
  handleSetMarbles(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; names: string[] }) {
    const { roomId, names } = data;
    try {
      this.roomManagerService.setMarbles(roomId, names);
      const gameState = this.roomManagerService.getGameState(roomId);
      this.server.to(roomId).emit('game_state', gameState);
      this.logger.log(`방 ${roomId}의 마블 설정 변경 by ${client.id}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting marbles in room ${roomId} by ${client.id}: ${message}`);
      return { success: false, message: `마블 설정 중 오류 발생: ${message}` };
    }
  }

  // 우승 순위 설정 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('set_winning_rank')
  handleSetWinningRank(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; rank: number }) {
    const { roomId, rank } = data;
     try {
      this.roomManagerService.setWinningRank(roomId, rank);
      const gameState = this.roomManagerService.getGameState(roomId);
      this.server.to(roomId).emit('game_state', gameState);
      this.logger.log(`방 ${roomId}의 우승 순위 ${rank}로 설정 by ${client.id}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting winning rank in room ${roomId} by ${client.id}: ${message}`);
      return { success: false, message: `우승 순위 설정 중 오류 발생: ${message}` };
    }
  }

  // 맵 설정 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('set_map')
  handleSetMap(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; mapIndex: number }) {
    const { roomId, mapIndex } = data;
    try {
      this.roomManagerService.setMap(roomId, mapIndex);
      const gameState = this.roomManagerService.getGameState(roomId);
      this.server.to(roomId).emit('game_state', gameState);
      this.logger.log(`방 ${roomId}의 맵 ${mapIndex}로 설정 by ${client.id}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting map in room ${roomId} by ${client.id}: ${message}`);
      return { success: false, message: `맵 설정 중 오류 발생: ${message}` };
    }
  }

  // 속도 설정 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('set_speed')
  handleSetSpeed(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; speed: number }) {
    const { roomId, speed } = data;
    try {
      this.roomManagerService.setSpeed(roomId, speed);
      this.server.to(roomId).emit('speed_changed', { speed }); // 상태 전체 대신 변경된 속도만 전송
      this.logger.log(`방 ${roomId}의 속도 ${speed}로 설정 by ${client.id}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting speed in room ${roomId} by ${client.id}: ${message}`);
      return { success: false, message: `속도 설정 중 오류 발생: ${message}` };
    }
  }

  // 게임 시작 처리 (GameEngineService 사용하도록 수정)
  @SubscribeMessage('start_game')
  handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    try {
      // RoomManagerService에서 게임 상태를 '시작됨'으로 변경
      this.roomManagerService.startGame(roomId); // startGame 내부 로직은 RoomManager에 있을 수 있음

      // 게임 시작 이벤트 전송
      this.server.to(roomId).emit('game_started');

      // GameEngineService를 통해 게임 루프 시작
      this.gameEngineService.startGameLoop(roomId, this.server);

      this.logger.log(`방 ${roomId}에서 게임 시작 by ${client.id}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error starting game in room ${roomId} by ${client.id}: ${message}`);
      return { success: false, message: `게임 시작 중 오류 발생: ${message}` };
    }
  }

  // 게임 리셋 처리 (GameEngineService 사용하도록 수정)
  @SubscribeMessage('reset_game')
  handleResetGame(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    try {
      // 게임 루프 중지
      this.gameEngineService.stopGameLoop(roomId);

      // RoomManagerService에서 게임 상태 리셋
      this.roomManagerService.resetGame(roomId);

      // 게임 리셋 및 상태 변경 이벤트 전송
      const gameState = this.roomManagerService.getGameState(roomId);
      this.server.to(roomId).emit('game_reset');
      this.server.to(roomId).emit('game_state', gameState); // 리셋 후 상태 전송

      this.logger.log(`방 ${roomId} 게임 리셋 by ${client.id}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error resetting game in room ${roomId} by ${client.id}: ${message}`);
      return { success: false, message: `게임 리셋 중 오류 발생: ${message}` };
    }
  }

  // 게임 상태 가져오기 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('get_game_state')
  handleGetGameState(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
    try {
      const gameState = this.roomManagerService.getGameState(roomId);
      return { success: true, gameState };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting game state for room ${roomId}: ${message}`);
      return { success: false, message: `게임 상태 조회 중 오류 발생: ${message}`, gameState: null };
    }
  }

  // 맵 목록 가져오기 (기존 로직 유지, roomId는 접두사 포함)
  @SubscribeMessage('get_maps')
  handleGetMaps(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const { roomId } = data;
     try {
      const maps = this.roomManagerService.getMaps(roomId);
      return { success: true, maps };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting maps for room ${roomId}: ${message}`);
      return { success: false, message: `맵 목록 조회 중 오류 발생: ${message}`, maps: [] };
    }
  }
}
