import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User, GameStatus } from '@prisma/client';
import { generateAnonymousNickname } from '../utils/nickname.util';
import { prefixGameRoomId, unprefixGameRoomId } from '../utils/roomId.util';
import { GameSessionService } from '../game-session.service';
import { GameEngineService } from '../game-engine.service';
import { RoomsService } from '../../rooms/rooms.service';
import { AuthService } from '../../auth/auth.service';
import { GamePersistenceService } from '../game-persistence.service';
import { JoinRoomDto } from '../dto/join-room.dto';
import { LeaveRoomDto } from '../dto/leave-room.dto';

@Injectable()
export class GameConnectionHandler {
  private readonly logger = new Logger(GameConnectionHandler.name);

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly gameEngineService: GameEngineService,
    private readonly roomsService: RoomsService,
    private readonly authService: AuthService,
    private readonly gamePersistenceService: GamePersistenceService,
  ) {}

  private async _verifyRoomAccess(roomId: number, password?: string): Promise<any> { // 'any' 대신 실제 Room 타입을 사용해야 합니다. Prisma Client의 Room 타입으로 가정합니다.
    let roomDetailsFromDb;
    try {
      roomDetailsFromDb = await this.roomsService.getRoom(roomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof WsException) throw error;
      throw new WsException(message || `방(ID: ${roomId}) 정보를 찾을 수 없거나 접근 중 오류가 발생했습니다.`);
    }

    if (!roomDetailsFromDb || roomDetailsFromDb.deletedAt) {
      throw new WsException(`존재하지 않거나 접근할 수 없는 방입니다: ${roomId}`);
    }

    // 비밀번호 검증
    if (roomDetailsFromDb.password) {
      if (!password) {
        throw new WsException('비밀번호가 필요합니다.');
      }
      const isPasswordCorrect = await this.roomsService.verifyRoomPassword(roomId, password);
      if (!isPasswordCorrect) {
        throw new WsException('잘못된 비밀번호입니다.');
      }
    }
    return roomDetailsFromDb;
  }

  private async _ensureRoomIsLoaded(roomId: number): Promise<void> {
    if (!this.gameSessionService.isRoomLoaded(roomId)) {
      try {
        this.logger.log(`방 ${roomId}가 메모리에 없습니다. DB에서 로드합니다.`);
        const loadedRoom = await this.gameSessionService.loadRoomFromDB(roomId);
        if (!loadedRoom) {
          throw new WsException(`방 ${roomId}에 접속 중 오류가 발생했습니다.`);
        }
        this.logger.log(`방 ${roomId}가 DB로부터 메모리에 성공적으로 로드/설정되었습니다.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof WsException) throw error;
        throw new WsException(message || `방 ${roomId}에 접속 중 내부 오류가 발생했습니다.`);
      }
    } else {
      this.logger.log(`방 ${roomId}는 이미 메모리에 로드되어 있습니다.`);
    }
  }

  private _notifyPlayerJoinedAndSendInitialState(
    client: Socket,
    roomId: number,
    userInfo: { id: string | number; nickname: string; isAnonymous: boolean },
    server: Server,
  ): void {
    const prefixedRoomId = prefixGameRoomId(roomId);
    client.join(prefixedRoomId);

    client.to(prefixedRoomId).emit('player_joined', {
      playerId: client.id,
      userInfo: userInfo,
    });

    const gameState = this.gameSessionService.getGameState(roomId);
    const maps = this.gameSessionService.getMaps(roomId);
    client.emit('available_maps', maps); // 초기 맵 정보 전송
    // gameState는 join_room의 반환값으로 전달되므로 여기서 emit하지 않아도 될 수 있습니다.
    // 하지만 일관성을 위해 또는 다른 클라이언트에게도 즉시 전파해야 한다면 여기서 emit('game_state', gameState)를 호출할 수 있습니다.
    // 현재는 join_room의 반환값으로 gameState를 전달하고 있으므로, 여기서는 available_maps만 emit합니다.

    this.logger.log(
      `새로운 플레이어 참여 알림: ${userInfo.nickname} (${client.id}) - 방 ${prefixedRoomId}(${roomId})`,
    );
  }

  private _determineUserInfo(client: Socket): { id: string | number; nickname: string; isAnonymous: boolean } {
    const currentUser = client.user;
    if (currentUser) {
      if ('isAnonymous' in currentUser && currentUser.isAnonymous) {
        return {
          id: currentUser.id as string, // AnonymousUser의 id는 string (소켓 ID)
          nickname: currentUser.nickname,
          isAnonymous: true,
        };
      } else {
        return {
          id: (currentUser as User).id, // User의 id는 number (DB ID)
          nickname: currentUser.nickname,
          isAnonymous: false,
        };
      }
    }
    // 익명 사용자 기본값
    return {
      id: client.id,
      nickname: generateAnonymousNickname(client.id),
      isAnonymous: true,
    };
  }

  private async _handlePlayerDepartureInternal(prefixedRoomId: string, client: Socket, server: Server, isDisconnect: boolean) {
    let roomId: number;
    try {
      roomId = unprefixGameRoomId(prefixedRoomId);
    } catch (error) {
      // unprefixGameRoomId 실패 시 로그만 남기고 함수 종료 (prefixedRoomId가 유효하지 않은 경우)
      this.logger.error(`_handlePlayerDepartureInternal: Invalid prefixedRoomId ${prefixedRoomId}. Error: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const nickname = client.user?.nickname || (isDisconnect ? '익명' : generateAnonymousNickname(client.id));

    // 플레이어 퇴장 알림
    client.to(prefixedRoomId).emit('player_left', {
      playerId: client.id,
      nickname: nickname,
    });
    this.logger.log(
      `방 ${prefixedRoomId}(${roomId})에서 플레이어 ${nickname} (${client.id}) ${isDisconnect ? '연결 종료로 퇴장' : '자발적 퇴장'}`,
    );

    if (!isDisconnect) { // 자발적 퇴장 시에만 소켓 룸에서 명시적으로 나감
      client.leave(prefixedRoomId);
    }

    // 방 정리 로직 (GameSessionService 위임)
    await this.gameSessionService.handlePlayerDeparture(roomId, server);

    // 방에 남은 소켓이 없으면 게임 루프 중지
    // handleDisconnect에서는 이미 client.rooms에 해당 방이 없을 수 있으므로, 항상 fetchSockets로 확인
    const socketsInRoom = await server.in(prefixedRoomId).fetchSockets();
    if (socketsInRoom.length === 0) {
      this.logger.log(`방 ${prefixedRoomId}(${roomId})에 남은 플레이어가 없어 게임 루프를 중지합니다.`);
      this.gameEngineService.stopGameLoop(roomId, server);
    }
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
    this.logger.log(`새로운 클라이언트 연결 시도: ${client.id} (토큰 존재 여부: ${!!token})`);

    if (token) {
      try {
        const user = await this.authService.getUserFromToken(token);
        if (user) {
          client.user = user; // 소켓에 사용자 정보 저장
          this.logger.log(`클라이언트 ${user.nickname}(${client.id}) 인증 성공`);
        } else {
          // this.logger.warn(`클라이언트 ${client.id} 인증 실패: 유효하지 않은 토큰 또는 사용자 없음`); // 필터에서 로깅
          client.emit('auth_error', { message: '인증에 실패했습니다. 유효하지 않은 토큰입니다.' }); // 특정 에러 이벤트 유지
          client.disconnect();
          throw new WsException('유효하지 않은 토큰 또는 사용자 없음'); // 필터가 처리하도록 WsException 발생
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // this.logger.error(`클라이언트 ${client.id} 인증 중 오류 발생: ${message}`); // 필터에서 로깅
        client.emit('auth_error', { message: `인증 중 오류 발생: ${message}` }); // 특정 에러 이벤트 유지
        client.disconnect();
        throw new WsException(message || '인증 중 오류 발생'); // 필터가 처리하도록 WsException 발생
      }
    } else {
      // 토큰이 없는 경우, 익명 사용자로 처리
      const anonymousNickname = generateAnonymousNickname(client.id);
      client.user = { id: client.id, nickname: anonymousNickname, isAnonymous: true };
      this.logger.log(`클라이언트 ${client.id} 익명으로 연결 (토큰 없음). 닉네임: ${anonymousNickname}`);
    }
  }

  async handleDisconnect(client: Socket, server: Server) {
    this.logger.log(`클라이언트 연결 종료: ${client.id} (${new Date().toLocaleString()})`);
    const joinedPrefixedRoomIds = Array.from(client.rooms.values()).filter((room) => room !== client.id);

    for (const prefixedRoomId of joinedPrefixedRoomIds) {
      try {
        // roomId를 내부에서 처리하므로 prefixedRoomId만 전달
        await this._handlePlayerDepartureInternal(prefixedRoomId, client, server, true);
      } catch (error: unknown) {
        // _handlePlayerDepartureInternal 내부에서 unprefix 에러는 이미 처리됨.
        // 여기서는 _handlePlayerDepartureInternal 자체에서 발생할 수 있는 다른 예외를 로깅 (예: DB 작업 실패)
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`클라이언트 ${client.id}의 연결 종료 처리 중 방 ${prefixedRoomId}에서 예기치 않은 오류: ${message}`);
      }
    }
  }

  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
    server: Server,
  ) {
    const { roomId, password } = data;
    // const currentUser = client.user; // _determineUserInfo 내부에서 client.user 사용

    const finalUserInfo = this._determineUserInfo(client);

    // roomDetailsFromDb 조회 및 검증 로직은 WsException을 이미 잘 활용하고 있으므로 유지하거나,
    // 필요시 catch 블록에서 logger.warn을 제거하고 throw new WsException만 남길 수 있습니다.
    // 여기서는 WsException을 그대로 사용하고, logger.warn은 필터에서 처리될 수 있도록 제거합니다.
    const roomDetailsFromDb = await this._verifyRoomAccess(roomId, password);

    // DB에서 직접 게임 상태 확인
    const gameRecord = await this.gamePersistenceService.loadGameData(roomId);

    if (gameRecord && gameRecord.status === GameStatus.FINISHED) {
      // this.logger.warn(
      //   `클라이언트 ${finalUserInfo.nickname} (${client.id})가 이미 종료된 방 ${roomId} 참가를 시도했습니다.`,
      // );
      throw new WsException('이미 종료된 게임입니다. 참가할 수 없습니다.');
    }

    // 방이 메모리에 로드되어 있는지 확인하고, 없다면 DB에서 로드
    await this._ensureRoomIsLoaded(roomId);

    this._notifyPlayerJoinedAndSendInitialState(client, roomId, finalUserInfo, server);
    
    const gameState = this.gameSessionService.getGameState(roomId); // gameState는 여전히 반환값에 필요
    this.logger.log(
      `플레이어 ${finalUserInfo.nickname} (${client.id}) 방 ${roomId} 참여 완료 (${new Date().toLocaleString()})`,
    );
    return { success: true, message: `방 ${roomId}에 참여했습니다.`, gameState };
  }

  async handleLeaveRoom(
    @ConnectedSocket() client: Socket, 
    @MessageBody() data: LeaveRoomDto,
    server: Server
  ) {
    const { roomId } = data; // roomId는 DTO에서 오므로 유효하다고 가정
    const prefixedRoomId = prefixGameRoomId(roomId);
    try {
      await this._handlePlayerDepartureInternal(prefixedRoomId, client, server, false);
      return { success: true, message: `방 ${roomId}에서 나갔습니다.` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WsException(message || '방 나가기 처리 중 오류 발생');
    }
  }
}
