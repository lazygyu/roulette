import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameSessionService } from './game-session.service';
import { GameEngineService } from './game-engine.service';
import { Logger, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common'; // UseGuards 임포트 추가
import { PrismaService } from '../prisma/prisma.service';
import { generateAnonymousNickname } from './utils/nickname.util';
import { prefixRoomId, unprefixRoomId } from './utils/roomId.util';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard'; // WsJwtAuthGuard 임포트
import { SocketCurrentUser } from '../decorators/socket-user.decorator'; // SocketCurrentUser 임포트
import { User } from '@prisma/client'; // User 임포트
import { RoomsService } from '../rooms/rooms.service'; // RoomsService 임포트

// DTO 임포트
import { JoinRoomDto } from './dto/join-room.dto';
import { LeaveRoomDto } from './dto/leave-room.dto';
import { SetMarblesDto } from './dto/set-marbles.dto';
import { SetWinningRankDto } from './dto/set-winning-rank.dto';
import { SetMapDto } from './dto/set-map.dto';
import { SetSpeedDto } from './dto/set-speed.dto';
import { StartGameDto } from './dto/start-game.dto';
import { ResetGameDto } from './dto/reset-game.dto';
import { GetGameStateDto } from './dto/get-game-state.dto';
import { GetMapsDto } from './dto/get-maps.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'game',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, exceptionFactory: (errors) => new WsException(errors) })) // 게이트웨이 레벨에서 ValidationPipe 적용
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly gameEngineService: GameEngineService,
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService, // RoomsService 주입
  ) {}

  afterInit() {
    this.logger.log('Game WebSocket Gateway 초기화 완료');
  }

  handleConnection(client: Socket) {
    this.logger.log(`새로운 클라이언트 연결: ${client.id} (${new Date().toLocaleString()})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 종료: ${client.id} (${new Date().toLocaleString()})`);
    const joinedPrefixedRoomIds = Array.from(client.rooms.values()).filter((room) => room !== client.id);

    joinedPrefixedRoomIds.forEach((prefixedRoomId) => {
      let roomId: number;
      try {
        roomId = unprefixRoomId(prefixedRoomId);
        const players = this.gameSessionService.getPlayers(roomId);
        const player = players.find(p => p.id === client.id);
        this.gameSessionService.removePlayer(roomId, client.id);

        client.to(prefixedRoomId).emit('player_left', {
          playerId: client.id,
          nickname: player?.userInfo.nickname || generateAnonymousNickname(client.id),
        });
        this.logger.log(`방 ${prefixedRoomId}(${roomId})에서 플레이어 ${player?.userInfo.nickname || '익명'} (${client.id}) 퇴장`);

        if (this.gameEngineService.isLoopRunning(roomId)) {
           this.logger.log(`Player left room ${prefixedRoomId}(${roomId}) while game loop was running.`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error handling disconnect for client ${client.id} in room ${prefixedRoomId}: ${message}`);
      }
    });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto, // DTO 사용
  ) {
    const { roomId, userInfo } = data; // roomId는 이제 number
    const finalUserInfo = userInfo || { nickname: generateAnonymousNickname(client.id) };

    const roomExists = await this.prisma.room.findUnique({
      where: { id: roomId }, // 숫자 roomId 직접 사용
      select: { id: true },
    });

    if (!roomExists) {
      this.logger.warn(`존재하지 않는 방(ID: ${roomId}) 접근 시도: ${client.id}`);
      throw new WsException(`존재하지 않는 방입니다: ${roomId}`);
    }

    const prefixedRoomId = prefixRoomId(roomId);
    client.join(prefixedRoomId);
    this.gameSessionService.addPlayer(roomId, client.id, finalUserInfo);

    const currentPlayers = this.gameSessionService.getPlayers(roomId);
    this.logger.log(`방 ${prefixedRoomId}(${roomId}) 현재 플레이어 목록 (${currentPlayers.length}명):`);
    currentPlayers.forEach((p) => this.logger.log(`- ${p.userInfo.nickname} (${p.id})`));

    client.to(prefixedRoomId).emit('player_joined', {
      playerId: client.id,
      userInfo: finalUserInfo,
    });

    const gameState = this.gameSessionService.getGameState(roomId);
    const maps = this.gameSessionService.getMaps(roomId);
    client.emit('game_state', gameState);
    client.emit('available_maps', maps);

    this.logger.log(
      `새로운 플레이어 참여: ${finalUserInfo.nickname} (${client.id}) - 방 ${prefixedRoomId}(${roomId}) (${new Date().toLocaleString()})`,
    );
    return { success: true, message: `방 ${roomId}에 참여했습니다.` };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: LeaveRoomDto) { // DTO 사용
    const { roomId } = data;
    const prefixedRoomId = prefixRoomId(roomId);
    try {
      const players = this.gameSessionService.getPlayers(roomId);
      const player = players.find(p => p.id === client.id);
      const nickname = player?.userInfo.nickname || generateAnonymousNickname(client.id);

      client.leave(prefixedRoomId);
      this.gameSessionService.removePlayer(roomId, client.id);

      client.to(prefixedRoomId).emit('player_left', {
        playerId: client.id,
        nickname: nickname,
      });

      this.logger.log(`클라이언트 ${nickname} (${client.id})가 방 ${prefixedRoomId}(${roomId})에서 나갔습니다.`);

      if (this.gameEngineService.isLoopRunning(roomId)) {
        this.logger.log(`Player left room ${prefixedRoomId}(${roomId}) while game loop was running.`);
      }
      return { success: true, message: `방 ${roomId}에서 나갔습니다.` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error leaving room ${prefixedRoomId}(${roomId}) for client ${client.id}: ${message}`);
      throw new WsException(`방 나가기 처리 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard) // 가드 적용
  @SubscribeMessage('set_marbles')
  async handleSetMarbles( // async 추가
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMarblesDto,
    @SocketCurrentUser() user: User, // 사용자 정보 가져오기
  ) {
    const { roomId, names } = data;
    const prefixedRoomId = prefixRoomId(roomId);

    // 권한 확인
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 마블을 설정할 수 있습니다.');
    }

    try {
      this.gameSessionService.setMarbles(roomId, names);
      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 마블 설정 변경 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting marbles in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`);
      throw new WsException(`마블 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard) // 가드 적용
  @SubscribeMessage('set_winning_rank')
  async handleSetWinningRank( // async 추가
     @ConnectedSocket() client: Socket,
     @MessageBody() data: SetWinningRankDto,
     @SocketCurrentUser() user: User, // 사용자 정보 가져오기
  ) {
    const { roomId, rank } = data;
    const prefixedRoomId = prefixRoomId(roomId);

    // 권한 확인
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 우승 순위를 설정할 수 있습니다.');
    }

     try {
      this.gameSessionService.setWinningRank(roomId, rank);
      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 우승 순위 ${rank}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting winning rank in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`);
      throw new WsException(`우승 순위 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard) // 가드 적용
  @SubscribeMessage('set_map')
  async handleSetMap( // async 추가
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMapDto,
    @SocketCurrentUser() user: User, // 사용자 정보 가져오기
  ) {
    const { roomId, mapIndex } = data;
    const prefixedRoomId = prefixRoomId(roomId);

    // 권한 확인
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 맵을 설정할 수 있습니다.');
    }

    try {
      this.gameSessionService.setMap(roomId, mapIndex);
      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 맵 ${mapIndex}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting map in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`);
      throw new WsException(`맵 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard) // 가드 적용
  @SubscribeMessage('set_speed')
  async handleSetSpeed( // async 추가
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetSpeedDto,
    @SocketCurrentUser() user: User, // 사용자 정보 가져오기
  ) {
    const { roomId, speed } = data;
    const prefixedRoomId = prefixRoomId(roomId);

    // 권한 확인
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 속도를 설정할 수 있습니다.');
    }

    try {
      this.gameSessionService.setSpeed(roomId, speed);
      this.server.to(prefixedRoomId).emit('speed_changed', { speed });
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 속도 ${speed}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting speed in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`);
      throw new WsException(`속도 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard) // 가드 적용
  @SubscribeMessage('start_game')
  async handleStartGame( // async 추가
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartGameDto,
    @SocketCurrentUser() user: User, // 사용자 정보 가져오기
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixRoomId(roomId);

    // 권한 확인
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 게임을 시작할 수 있습니다.');
    }

    try {
      this.gameSessionService.startGame(roomId);
      this.server.to(prefixedRoomId).emit('game_started');
      this.gameEngineService.startGameLoop(roomId, this.server);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 게임 시작 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error starting game in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`);
      throw new WsException(`게임 시작 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard) // 가드 적용
  @SubscribeMessage('reset_game')
  async handleResetGame( // async 추가
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ResetGameDto,
    @SocketCurrentUser() user: User, // 사용자 정보 가져오기
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixRoomId(roomId);

    // 권한 확인
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 게임을 리셋할 수 있습니다.');
    }

    try {
      this.gameEngineService.stopGameLoop(roomId);
      this.gameSessionService.resetGame(roomId);

      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_reset');
      this.server.to(prefixedRoomId).emit('game_state', gameState);

      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 게임 리셋 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error resetting game in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`);
      throw new WsException(`게임 리셋 중 오류 발생: ${message}`);
    }
  }

  @SubscribeMessage('get_game_state')
  handleGetGameState(@ConnectedSocket() client: Socket, @MessageBody() data: GetGameStateDto) { // DTO 사용
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

  @SubscribeMessage('get_maps')
  handleGetMaps(@ConnectedSocket() client: Socket, @MessageBody() data: GetMapsDto) { // DTO 사용
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
