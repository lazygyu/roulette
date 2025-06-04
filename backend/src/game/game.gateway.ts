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
import { Logger, UsePipes, ValidationPipe, UseGuards, UseFilters } from '@nestjs/common'; // UseFilters 추가
import { WsUserAttachedGuard } from '../auth/guards/ws-user-attached.guard';
import { SocketCurrentUser } from '../decorators/socket-user.decorator';
import { User } from '@prisma/client';

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

// 핸들러 임포트
import { GameConnectionHandler, GameConfigHandler, GameControlHandler, GameSkillHandler } from './handlers';
import { GlobalWsExceptionFilter } from './filters'; // GlobalWsExceptionFilter 임포트
import { GameSessionService } from './game-session.service'; // GameSessionService 임포트

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'game',
})
@UseFilters(new GlobalWsExceptionFilter()) // GlobalWsExceptionFilter 적용
@UsePipes(
  new ValidationPipe({ transform: true, whitelist: true, exceptionFactory: (errors) => new WsException(errors) }),
)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly connectionHandler: GameConnectionHandler,
    private readonly configHandler: GameConfigHandler,
    private readonly controlHandler: GameControlHandler,
    private readonly skillHandler: GameSkillHandler,
    private readonly gameSessionService: GameSessionService, // GameSessionService 주입
  ) {}

  afterInit() {
    this.logger.log('Game WebSocket Gateway 초기화 완료');
    this.gameSessionService.setIoServer(this.server); // GameSessionService에 Server 인스턴스 전달
  }

  async handleConnection(client: Socket) {
    await this.connectionHandler.handleConnection(client);
  }

  async handleDisconnect(client: Socket) {
    await this.connectionHandler.handleDisconnect(client, this.server);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: JoinRoomDto) {
    return await this.connectionHandler.handleJoinRoom(client, data, this.server);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: LeaveRoomDto) {
    return await this.connectionHandler.handleLeaveRoom(client, data, this.server);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('set_marbles')
  async handleSetMarbles(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMarblesDto,
    @SocketCurrentUser() user: User,
  ) {
    return await this.configHandler.handleSetMarbles(client, data, user, this.server);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('set_winning_rank')
  async handleSetWinningRank(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetWinningRankDto,
    @SocketCurrentUser() user: User,
  ) {
    return await this.configHandler.handleSetWinningRank(client, data, user, this.server);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('set_map')
  async handleSetMap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetMapDto,
    @SocketCurrentUser() user: User,
  ) {
    return await this.configHandler.handleSetMap(client, data, user, this.server);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('set_speed')
  async handleSetSpeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SetSpeedDto,
    @SocketCurrentUser() user: User,
  ) {
    return await this.configHandler.handleSetSpeed(client, data, user, this.server);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartGameDto,
    @SocketCurrentUser() user: User,
  ) {
    return await this.controlHandler.handleStartGame(client, data, user, this.server);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('reset_game')
  async handleResetGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ResetGameDto,
    @SocketCurrentUser() user: User,
  ) {
    return await this.controlHandler.handleResetGame(client, data, user, this.server);
  }

  @SubscribeMessage('get_game_state')
  handleGetGameState(@ConnectedSocket() client: Socket, @MessageBody() data: GetGameStateDto) {
    return this.controlHandler.handleGetGameState(client, data);
  }

  @SubscribeMessage('get_maps')
  handleGetMaps(@ConnectedSocket() client: Socket, @MessageBody() data: GetMapsDto) {
    return this.controlHandler.handleGetMaps(client, data);
  }

  @UseGuards(WsUserAttachedGuard)
  @SubscribeMessage('use_skill')
  async handleUseSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UseSkillDto<any>,
    @SocketCurrentUser() user: User,
  ) {
    return await this.skillHandler.handleUseSkill(client, data, user, this.server);
  }
}
