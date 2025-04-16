import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { GameService } from './game.service';
import { GameStatus } from './types/game-state.type';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'game',
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);
  
  @WebSocketServer() server!: Server;
  
  constructor(private gameService: GameService) {}
  
  afterInit(server: Server): void {
    this.logger.log('Game WebSocket Gateway initialized');
  }
  
  handleConnection(client: Socket, ...args: any[]): void {
    this.logger.log(`Client connected to game: ${client.id}`);
  }
  
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from game: ${client.id}`);
    
    // 클라이언트가 특정 방에 있었으면 해당 정보 정리
    if (client.data.roomId) {
      // 만약 해당 방에 더 이상 사용자가 없다면 게임 자원 정리
      const roomId = client.data.roomId;
      const roomChannel = `room_${roomId}`;
      
      this.server.in(roomChannel).fetchSockets().then(sockets => {
        if (sockets.length === 0) {
          this.gameService.cleanupGame(roomId);
          this.logger.log(`Game cleaned up for empty room: ${roomId}`);
        }
      });
    }
  }
  
  // 게임 초기화
  @SubscribeMessage('initializeGame')
  async handleInitializeGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number }
  ): Promise<void> {
    try {
      const { roomId } = payload;
      
      // 게임 초기화
      const gameState = await this.gameService.initializeGame(roomId);
      
      // 클라이언트의 방 정보 설정
      client.data.roomId = roomId;
      const roomChannel = `room_${roomId}`;
      await client.join(roomChannel);
      
      // 초기화 완료 알림
      client.emit('gameInitialized', { roomId, gameState });
      
      // 방의 다른 사용자들에게도 알림
      client.to(roomChannel).emit('gameStateUpdated', gameState);
      
      this.logger.log(`Game initialized for room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: '게임 초기화 중 오류가 발생했습니다.' });
      this.logger.error(`Error initializing game: ${error}`);
    }
  }
  
  // 게임 상태 요청
  @SubscribeMessage('getGameState')
  handleGetGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number }
  ): void {
    try {
      const { roomId } = payload;
      const gameState = this.gameService.getGameState(roomId);
      
      if (!gameState) {
        client.emit('error', { message: '해당 방의 게임 상태를 찾을 수 없습니다.' });
        return;
      }
      
      client.emit('gameState', gameState);
    } catch (error) {
      client.emit('error', { message: '게임 상태 요청 중 오류가 발생했습니다.' });
      this.logger.error(`Error getting game state: ${error}`);
    }
  }
  
  // 마블 설정
  @SubscribeMessage('setMarbles')
  handleSetMarbles(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number, names: string[] }
  ): void {
    try {
      const { roomId, names } = payload;
      
      // 마블 설정
      this.gameService.setMarbles(roomId, names);
      
      // 업데이트된 게임 상태 가져오기
      const gameState = this.gameService.getGameState(roomId);
      
      // 방의 모든 사용자에게 알림
      const roomChannel = `room_${roomId}`;
      this.server.to(roomChannel).emit('gameStateUpdated', gameState);
      
      this.logger.log(`Marbles set for room ${roomId}: ${names.length} marbles`);
    } catch (error) {
      client.emit('error', { message: '마블 설정 중 오류가 발생했습니다.' });
      this.logger.error(`Error setting marbles: ${error}`);
    }
  }
  
  // 게임 시작
  @SubscribeMessage('startGame')
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number }
  ): void {
    try {
      const { roomId } = payload;
      
      // 게임 시작
      this.gameService.startGame(roomId);
      
      // 업데이트된 게임 상태 가져오기
      const gameState = this.gameService.getGameState(roomId);
      
      // 방의 모든 사용자에게 알림
      const roomChannel = `room_${roomId}`;
      this.server.to(roomChannel).emit('gameStateUpdated', gameState);
      this.server.to(roomChannel).emit('gameStarted', { roomId });
      
      // 게임 상태 업데이트 구독 설정
      this.startGameStateUpdates(roomId);
      
      this.logger.log(`Game started in room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: '게임 시작 중 오류가 발생했습니다.' });
      this.logger.error(`Error starting game: ${error}`);
    }
  }
  
  // 맵 설정
  @SubscribeMessage('setMap')
  handleSetMap(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number, mapIndex: number }
  ): void {
    try {
      const { roomId, mapIndex } = payload;
      
      // 맵 설정
      this.gameService.setMap(roomId, mapIndex);
      
      // 업데이트된 게임 상태 가져오기
      const gameState = this.gameService.getGameState(roomId);
      
      // 방의 모든 사용자에게 알림
      const roomChannel = `room_${roomId}`;
      this.server.to(roomChannel).emit('gameStateUpdated', gameState);
      this.server.to(roomChannel).emit('mapChanged', { roomId, mapIndex });
      
      this.logger.log(`Map set for room ${roomId}: map ${mapIndex}`);
    } catch (error) {
      client.emit('error', { message: '맵 설정 중 오류가 발생했습니다.' });
      this.logger.error(`Error setting map: ${error}`);
    }
  }
  
  // 마블 흔들기
  @SubscribeMessage('shakeMarble')
  handleShakeMarble(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number, marbleId: number }
  ): void {
    try {
      const { roomId, marbleId } = payload;
      
      // 마블 흔들기
      this.gameService.shakeMarble(roomId, marbleId);
      
      // 방의 모든 사용자에게 알림
      const roomChannel = `room_${roomId}`;
      this.server.to(roomChannel).emit('marbleShaken', { roomId, marbleId });
      
      this.logger.log(`Marble ${marbleId} shaken in room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: '마블 흔들기 중 오류가 발생했습니다.' });
      this.logger.error(`Error shaking marble: ${error}`);
    }
  }
  
  // 게임 리셋
  @SubscribeMessage('resetGame')
  handleResetGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number }
  ): void {
    try {
      const { roomId } = payload;
      
      // 게임 리셋
      this.gameService.resetGame(roomId);
      
      // 업데이트된 게임 상태 가져오기
      const gameState = this.gameService.getGameState(roomId);
      
      // 방의 모든 사용자에게 알림
      const roomChannel = `room_${roomId}`;
      this.server.to(roomChannel).emit('gameStateUpdated', gameState);
      this.server.to(roomChannel).emit('gameReset', { roomId });
      
      this.logger.log(`Game reset in room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: '게임 리셋 중 오류가 발생했습니다.' });
      this.logger.error(`Error resetting game: ${error}`);
    }
  }
  
  // 맵 목록 가져오기
  @SubscribeMessage('getMaps')
  handleGetMaps(
    @ConnectedSocket() client: Socket
  ): void {
    try {
      const maps = this.gameService.getMaps();
      client.emit('mapsList', { maps });
    } catch (error) {
      client.emit('error', { message: '맵 목록 요청 중 오류가 발생했습니다.' });
      this.logger.error(`Error getting maps: ${error}`);
    }
  }
  
  // 게임 상태 업데이트 구독
  private startGameStateUpdates(roomId: number): void {
    const interval = setInterval(() => {
      const gameState = this.gameService.getGameState(roomId);
      
      if (!gameState) {
        clearInterval(interval);
        return;
      }
      
      // 게임이 종료되었으면 구독 중지
      if (gameState.status === GameStatus.FINISHED) {
        clearInterval(interval);
        
        // 게임 종료 이벤트 발송
        const roomChannel = `room_${roomId}`;
        this.server.to(roomChannel).emit('gameFinished', {
          roomId,
          winner: gameState.winner
        });
        
        return;
      }
      
      // 실행 중인 게임만 상태 업데이트 전송
      if (gameState.status === GameStatus.RUNNING) {
        const roomChannel = `room_${roomId}`;
        this.server.to(roomChannel).emit('gameStateUpdated', gameState);
      }
    }, 50); // 50ms마다 업데이트 (약 20fps로 클라이언트에 전송)
  }
} 