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

  async handleDisconnect(client: Socket, server: Server) {
    this.logger.log(`클라이언트 연결 종료: ${client.id} (${new Date().toLocaleString()})`);
    const joinedPrefixedRoomIds = Array.from(client.rooms.values()).filter((room) => room !== client.id);

    for (const prefixedRoomId of joinedPrefixedRoomIds) {
      let roomId: number;
      try {
        roomId = unprefixGameRoomId(prefixedRoomId);
        // 플레이어 퇴장 알림은 유지
        client.to(prefixedRoomId).emit('player_left', {
          playerId: client.id,
          nickname: client.user?.nickname || '익명',
        });
        this.logger.log(
          `방 ${prefixedRoomId}(${roomId})에서 플레이어 ${client.user?.nickname || '익명'} (${client.id}) 퇴장`,
        );

        // 방 정리 로직을 GameSessionService로 위임
        await this.gameSessionService.handlePlayerDeparture(roomId, server);
        
        const socketsInRoom = await server.in(prefixedRoomId).fetchSockets();
        if (socketsInRoom.length === 0) {
          this.gameEngineService.stopGameLoop(roomId, server); // 게임 루프 중지 및 소켓 정리
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error handling disconnect for client ${client.id} in room ${prefixedRoomId}: ${message}`);
      }
    }
  }

  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
    server: Server,
  ) {
    const { roomId, password } = data;
    const currentUser = client.user;

    // finalUserInfo 구성: 인증된 사용자 또는 익명 사용자 정보
    const finalUserInfo = currentUser
      ? 'isAnonymous' in currentUser && currentUser.isAnonymous
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
          id: client.id,
          nickname: generateAnonymousNickname(client.id),
          isAnonymous: true,
        };

    let roomDetailsFromDb;
    try {
      roomDetailsFromDb = await this.roomsService.getRoom(roomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`방(ID: ${roomId}) 정보 조회 실패: ${message}`);
      if (error instanceof WsException) throw error;
      throw new WsException(`방(ID: ${roomId}) 정보를 찾을 수 없거나 접근 중 오류가 발생했습니다.`);
    }

    if (!roomDetailsFromDb || roomDetailsFromDb.deletedAt) {
      this.logger.warn(`존재하지 않거나 삭제된 방(ID: ${roomId}) 접근 시도: ${client.id}`);
      throw new WsException(`존재하지 않거나 접근할 수 없는 방입니다: ${roomId}`);
    }

    // DB에서 직접 게임 상태 확인
    const gameRecord = await this.gamePersistenceService.loadGameData(roomId);

    if (gameRecord && gameRecord.status === GameStatus.FINISHED) {
      this.logger.warn(
        `클라이언트 ${finalUserInfo.nickname} (${client.id})가 이미 종료된 방 ${roomId} 참가를 시도했습니다.`,
      );
      throw new WsException('이미 종료된 게임입니다. 참가할 수 없습니다.');
    }

    // 비밀번호 검증
    if (roomDetailsFromDb.password) {
      if (!password) {
        this.logger.warn(`비밀번호가 필요한 방(ID: ${roomId})에 비밀번호 없이 접근 시도: ${client.id}`);
        throw new WsException('비밀번호가 필요합니다.');
      }
      const isPasswordCorrect = await this.roomsService.verifyRoomPassword(roomId, password);
      if (!isPasswordCorrect) {
        this.logger.warn(`방(ID: ${roomId})에 잘못된 비밀번호로 접근 시도: ${client.id}`);
        throw new WsException('잘못된 비밀번호입니다.');
      }
    }

    // 방이 메모리에 로드되어 있는지 확인하고, 없다면 DB에서 로드
    if (!this.gameSessionService.isRoomLoaded(roomId)) {
      try {
        this.logger.log(`방 ${roomId}가 메모리에 없습니다. DB에서 로드합니다.`);
        const loadedRoom = await this.gameSessionService.loadRoomFromDB(roomId);
        if (!loadedRoom) {
          this.logger.error(`DB에서 방 ${roomId} 로드 실패 또는 메모리 생성 실패.`);
          throw new WsException(`방 ${roomId}에 접속 중 오류가 발생했습니다.`);
        }
        this.logger.log(`방 ${roomId}가 DB로부터 메모리에 성공적으로 로드/설정되었습니다.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`방 ${roomId} 로드 중 예외 발생: ${message}`);
        if (error instanceof WsException) throw error;
        throw new WsException(`방 ${roomId}에 접속 중 내부 오류가 발생했습니다.`);
      }
    } else {
      this.logger.log(`방 ${roomId}는 이미 메모리에 로드되어 있습니다.`);
    }

    const prefixedRoomId = prefixGameRoomId(roomId);
    client.join(prefixedRoomId);

    client.to(prefixedRoomId).emit('player_joined', {
      playerId: client.id,
      userInfo: finalUserInfo,
    });

    const gameState = this.gameSessionService.getGameState(roomId);
    const maps = this.gameSessionService.getMaps(roomId);
    client.emit('available_maps', maps);

    this.logger.log(
      `새로운 플레이어 참여: ${finalUserInfo.nickname} (${client.id}) - 방 ${prefixedRoomId}(${roomId}) (${new Date().toLocaleString()})`,
    );
    
    return { success: true, message: `방 ${roomId}에 참여했습니다.`, gameState };
  }

  async handleLeaveRoom(
    @ConnectedSocket() client: Socket, 
    @MessageBody() data: LeaveRoomDto, 
    server: Server
  ) {
    const { roomId } = data;
    const prefixedRoomId = prefixGameRoomId(roomId);
    
    try {
      const nickname = client.user?.nickname || generateAnonymousNickname(client.id);

      client.leave(prefixedRoomId);

      client.to(prefixedRoomId).emit('player_left', {
        playerId: client.id,
        nickname: nickname,
      });

      this.logger.log(`클라이언트 ${nickname} (${client.id})가 방 ${prefixedRoomId}(${roomId})에서 나갔습니다.`);

      // 방 정리 로직을 GameSessionService로 위임
      await this.gameSessionService.handlePlayerDeparture(roomId, server);
      
      const socketsInRoom = await server.in(prefixedRoomId).fetchSockets();
      if (socketsInRoom.length === 0) {
        this.gameEngineService.stopGameLoop(roomId, server);
      }
      
      return { success: true, message: `방 ${roomId}에서 나갔습니다.` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error leaving room ${prefixedRoomId}(${roomId}) for client ${client.id}: ${message}`);
      throw new WsException(`방 나가기 처리 중 오류 발생: ${message}`);
    }
  }
}
