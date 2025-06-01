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
import { Logger, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { generateAnonymousNickname } from './utils/nickname.util';
import { prefixGameRoomId, unprefixGameRoomId } from './utils/roomId.util';
import { WsUserAttachedGuard } from '../auth/guards/ws-user-attached.guard';
import { SocketCurrentUser } from '../decorators/socket-user.decorator';
import { User } from '@prisma/client';
import { RoomsService } from '../rooms/rooms.service';
import { AuthService } from '../auth/auth.service'; // AuthService 임포트

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
import { UseSkillDto } from './dto/use-skill.dto';
import { SkillType } from './types/skill.type';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'game',
})
@UsePipes(
  new ValidationPipe({ transform: true, whitelist: true, exceptionFactory: (errors) => new WsException(errors) }),
) // 게이트웨이 레벨에서 ValidationPipe 적용
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly gameEngineService: GameEngineService,
    private readonly roomsService: RoomsService,
    private readonly authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log('Game WebSocket Gateway 초기화 완료');
  }

  async handleConnection(client: Socket) {
    // client 타입을 Socket으로 변경
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
    this.logger.log(`새로운 클라이언트 연결 시도: ${client.id} (토큰 존재 여부: ${!!token})`);

    if (token) {
      try {
        const user = await this.authService.getUserFromToken(token);
        if (user) {
          client.user = user; // 소켓에 사용자 정보 저장
          this.logger.log(`클라이언트 ${user.nickname}(${client.id}) 인증 성공`);
        } else {
          this.logger.warn(`클라이언트 ${client.id} 인증 실패: 유효하지 않은 토큰 또는 사용자 없음`);
          client.emit('auth_error', { message: '인증에 실패했습니다. 유효하지 않은 토큰입니다.' });
          client.disconnect();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`클라이언트 ${client.id} 인증 중 오류 발생: ${message}`);
        client.emit('auth_error', { message: `인증 중 오류 발생: ${message}` });
        client.disconnect();
      }
    } else {
      // 토큰이 없는 경우, 익명 사용자로 처리
      const anonymousNickname = generateAnonymousNickname(client.id);
      client.user = { id: client.id, nickname: anonymousNickname, isAnonymous: true };
      this.logger.log(`클라이언트 ${client.id} 익명으로 연결 (토큰 없음). 닉네임: ${anonymousNickname}`);
    }
  }

  handleDisconnect(client: Socket) {
    // client 타입을 Socket으로 변경
    this.logger.log(`클라이언트 연결 종료: ${client.id} (${new Date().toLocaleString()})`);
    const joinedPrefixedRoomIds = Array.from(client.rooms.values()).filter((room) => room !== client.id);

    joinedPrefixedRoomIds.forEach((prefixedRoomId) => {
      let roomId: number;
      try {
        roomId = unprefixGameRoomId(prefixedRoomId);
        const players = this.gameSessionService.getPlayers(roomId);
        const player = players.find((p) => p.id === client.id);
        this.gameSessionService.removePlayer(roomId, client.id);

        client.to(prefixedRoomId).emit('player_left', {
          playerId: client.id,
          nickname: player?.userInfo.nickname, // player.userInfo는 항상 존재하므로 fallback 제거
        });
        this.logger.log(
          `방 ${prefixedRoomId}(${roomId})에서 플레이어 ${player?.userInfo.nickname || '익명'} (${client.id}) 퇴장`, // 로그에는 익명 fallback 유지
        );

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
    @MessageBody() data: JoinRoomDto, // DTO 사용 (password 필드 포함)
    // @SocketCurrentUser() user: User, // SocketCurrentUser 데코레이터는 이제 User | AnonymousUser | null 반환
  ) {
    const { roomId, password } = data; // password 추출
    // client.user는 handleConnection에서 이미 User 또는 AnonymousUser로 설정됨
    const currentUser = client.user;

    // finalUserInfo 구성: 인증된 사용자 또는 익명 사용자 정보
    const finalUserInfo = currentUser
      ? 'isAnonymous' in currentUser && currentUser.isAnonymous // currentUser가 AnonymousUser 타입인지 확인
        ? {
            id: currentUser.id, // AnonymousUser의 id는 string (소켓 ID)
            nickname: currentUser.nickname,
            isAnonymous: true,
          }
        : {
            id: currentUser.id, // User의 id는 number (DB ID)
            nickname: currentUser.nickname,
            isAnonymous: false,
          }
      : {
          // 이 경우는 handleConnection에서 이미 익명으로 설정되므로 발생하지 않아야 함
          id: client.id,
          nickname: generateAnonymousNickname(client.id),
          isAnonymous: true,
        };

    let roomDetailsFromDb;
    try {
      // RoomsService의 getRoom 메서드가 password를 포함한 Room 엔티티를 반환한다고 가정
      // rooms.controller.ts의 findOne을 보면 roomsService.getRoom(id)가 password를 반환합니다.
      roomDetailsFromDb = await this.roomsService.getRoom(roomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`방(ID: ${roomId}) 정보 조회 실패: ${message}`);
      // NotFoundException 등이 RoomsService에서 발생할 수 있음
      if (error instanceof WsException) throw error;
      throw new WsException(`방(ID: ${roomId}) 정보를 찾을 수 없거나 접근 중 오류가 발생했습니다.`);
    }

    if (!roomDetailsFromDb || roomDetailsFromDb.deletedAt) {
      this.logger.warn(`존재하지 않거나 삭제된 방(ID: ${roomId}) 접근 시도: ${client.id}`);
      throw new WsException(`존재하지 않거나 접근할 수 없는 방입니다: ${roomId}`);
    }

    // 비밀번호 검증
    if (roomDetailsFromDb.password) {
      // 방에 비밀번호가 설정되어 있는 경우
      if (!password) {
        // 클라이언트가 비밀번호를 보내지 않은 경우
        this.logger.warn(`비밀번호가 필요한 방(ID: ${roomId})에 비밀번호 없이 접근 시도: ${client.id}`);
        throw new WsException('비밀번호가 필요합니다.');
      }
      // RoomsService에 비밀번호 검증 메서드를 만들어 위임하는 것이 좋음
      const isPasswordCorrect = await this.roomsService.verifyRoomPassword(roomId, password);
      if (!isPasswordCorrect) {
        this.logger.warn(`방(ID: ${roomId})에 잘못된 비밀번호로 접근 시도: ${client.id}`);
        throw new WsException('잘못된 비밀번호입니다.');
      }
    }
    // 비밀번호가 없거나, 비밀번호가 올바른 경우 아래 로직 계속 진행

    // 방이 메모리에 로드되어 있는지 확인하고, 없다면 DB에서 로드
    if (!this.gameSessionService.isRoomLoaded(roomId)) {
      try {
        this.logger.log(`방 ${roomId}가 메모리에 없습니다. DB에서 로드합니다.`);
        const loadedRoom = await this.gameSessionService.loadRoomFromDB(roomId);
        if (!loadedRoom) {
          // loadRoomFromDB가 null을 반환하는 경우는 gameData가 DB에 없을 때 newRoom을 만들어 반환하므로,
          // 이론적으로 이 지점에 도달하기 어려움.
          // 하지만 방어적으로, 만약 loadRoomFromDB가 어떤 이유로 null을 반환하고,
          // 메모리에도 방 생성이 안되었다면 에러 처리.
          this.logger.error(`DB에서 방 ${roomId} 로드 실패 또는 메모리 생성 실패.`);
          throw new WsException(`방 ${roomId}에 접속 중 오류가 발생했습니다.`);
        }
        this.logger.log(`방 ${roomId}가 DB로부터 메모리에 성공적으로 로드/설정되었습니다.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`방 ${roomId} 로드 중 예외 발생: ${message}`);
        if (error instanceof WsException) throw error; // WsException은 그대로 던짐
        throw new WsException(`방 ${roomId}에 접속 중 내부 오류가 발생했습니다.`);
      }
    } else {
      this.logger.log(`방 ${roomId}는 이미 메모리에 로드되어 있습니다.`);
    }

    const prefixedRoomId = prefixGameRoomId(roomId);
    client.join(prefixedRoomId);
    this.gameSessionService.addPlayer(roomId, client.id, finalUserInfo);

    const currentPlayers = this.gameSessionService.getPlayers(roomId);
    this.logger.log(`방 ${prefixedRoomId}(${roomId}) 현재 플레이어 목록 (${currentPlayers.length}명):`);
    currentPlayers.forEach((p) => this.logger.log(`- ${p.userInfo.nickname} (${p.id})`));

    client.to(prefixedRoomId).emit('player_joined', {
      playerId: client.id, // 소켓 ID
      userInfo: finalUserInfo, // 익명/인증 사용자 정보 포함
    });

    const gameState = this.gameSessionService.getGameState(roomId);
    const maps = this.gameSessionService.getMaps(roomId);
    // client.emit('game_state', gameState); // 클라이언트가 join_room의 ack 콜백으로 gameState를 받도록 변경
    client.emit('available_maps', maps); // available_maps는 계속 emit

    this.logger.log(
      `새로운 플레이어 참여: ${finalUserInfo.nickname} (${client.id}) - 방 ${prefixedRoomId}(${roomId}) (${new Date().toLocaleString()})`,
    );
    // ack 콜백에 gameState 포함
    return { success: true, message: `방 ${roomId}에 참여했습니다.`, gameState };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: LeaveRoomDto) {
    // DTO 사용
    const { roomId } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);
    try {
      const players = this.gameSessionService.getPlayers(roomId);
      const player = players.find((p) => p.id === client.id);
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

  @UseGuards(WsUserAttachedGuard) // 가드 변경
  @SubscribeMessage('set_marbles')
  async handleSetMarbles(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMarblesDto,
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId, names } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // WsUserAttachedGuard가 통과시켰으므로 user는 User 타입임을 보장
    // 익명 사용자는 이 가드를 통과할 수 없음
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 마블을 설정할 수 있습니다.');
    }

    try {
      await this.gameSessionService.setMarbles(roomId, names);
      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 마블 설정 변경 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error setting marbles in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`마블 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsUserAttachedGuard) // 가드 변경
  @SubscribeMessage('set_winning_rank')
  async handleSetWinningRank(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetWinningRankDto,
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId, rank } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // WsUserAttachedGuard가 통과시켰으므로 user는 User 타입임을 보장
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
      this.logger.error(
        `Error setting winning rank in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`우승 순위 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsUserAttachedGuard) // 가드 변경
  @SubscribeMessage('set_map')
  async handleSetMap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMapDto,
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId, mapIndex } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // WsUserAttachedGuard가 통과시켰으므로 user는 User 타입임을 보장
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new WsException('방의 매니저만 맵을 설정할 수 있습니다.');
    }

    try {
      await this.gameSessionService.setMap(roomId, mapIndex);
      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_state', gameState);
      this.logger.log(`방 ${prefixedRoomId}(${roomId}) 맵 ${mapIndex}로 설정 by ${user.nickname} (${client.id})`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error setting map in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`맵 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsUserAttachedGuard) // 가드 변경
  @SubscribeMessage('set_speed')
  async handleSetSpeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetSpeedDto,
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId, speed } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // WsUserAttachedGuard가 통과시켰으므로 user는 User 타입임을 보장
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
      this.logger.error(
        `Error setting speed in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`속도 설정 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsUserAttachedGuard) // 가드 변경
  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartGameDto,
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // WsUserAttachedGuard가 통과시켰으므로 user는 User 타입임을 보장
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
      this.logger.error(
        `Error starting game in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`게임 시작 중 오류 발생: ${message}`);
    }
  }

  @UseGuards(WsUserAttachedGuard) // 가드 변경
  @SubscribeMessage('reset_game')
  async handleResetGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ResetGameDto,
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);

    // WsUserAttachedGuard가 통과시켰으므로 user는 User 타입임을 보장
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
      this.logger.error(
        `Error resetting game in room ${prefixedRoomId}(${roomId}) by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`게임 리셋 중 오류 발생: ${message}`);
    }
  }

  @SubscribeMessage('get_game_state')
  handleGetGameState(@ConnectedSocket() client: Socket, @MessageBody() data: GetGameStateDto) {
    // DTO 사용
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
  handleGetMaps(@ConnectedSocket() client: Socket, @MessageBody() data: GetMapsDto) {
    // DTO 사용
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

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('use_skill')
  async handleUseSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UseSkillDto<any>, // 제네릭 DTO 사용
    @SocketCurrentUser() user: User, // WsUserAttachedGuard가 통과시킨 user는 User 타입임을 보장
  ) {
    const { roomId, skillType, skillPosition, extra } = data;
    this.logger.log('스킬 사용 요청 수신:', {
      roomId,
      skillType,
      skillPosition,
      extra,
      user: user ? `${user.nickname} (${user.id})` : '인증된 사용자', // 익명 사용자는 이 가드를 통과할 수 없음
    });
    const prefixedRoomId = prefixGameRoomId(roomId);

    try {
      // 스킬 사용 권한 확인 (예: 매니저만 사용 가능 또는 특정 조건)
      // 현재는 모든 인증된 사용자가 스킬을 사용할 수 있다고 가정
      // 필요하다면 this.roomsService.isManager(roomId, user.id)와 같은 로직 추가

      this.logger.log(
        `클라이언트 ${user.nickname} (${client.id})가 방 ${prefixedRoomId}(${roomId})에서 스킬 사용 시도: ${skillType}`,
      );

      // gameEngineService에 스킬 발동 로직 위임 (사용자 닉네임 전달)
      await this.gameEngineService.useSkill(roomId, skillType, skillPosition, extra, user.nickname);

      // 스킬 발동 후 게임 상태 업데이트 및 클라이언트에게 전파
      const gameState = this.gameSessionService.getGameState(roomId);
      this.server.to(prefixedRoomId).emit('game_state', gameState);
      // skill_used 이벤트는 game_state에 포함되므로 별도로 보낼 필요 없음

      this.logger.log(
        `방 ${prefixedRoomId}(${roomId})에서 스킬 ${skillType} 발동 완료 by ${user.nickname} (${client.id})`,
      );
      return { success: true, message: `스킬 ${skillType} 발동 성공` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `방 ${prefixedRoomId}(${roomId})에서 스킬 ${skillType} 발동 중 오류 발생 by ${user.nickname} (${client.id}): ${message}`,
      );
      throw new WsException(`스킬 발동 중 오류 발생: ${message}`);
    }
  }
}
