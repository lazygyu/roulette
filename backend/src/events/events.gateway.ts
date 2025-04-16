import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { EventsService } from './events.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*', // 실제 프로덕션 환경에서는 특정 출처만 허용하도록 변경해야 합니다.
  },
  namespace: 'rooms', // 네임스페이스 추가
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  constructor(private eventsService: EventsService) {}

  afterInit(server: Server) {
    // 초기화 시 필요한 설정이 있으면 여기에 추가
  }

  handleConnection(client: Socket, ...args: any[]) {
    // 클라이언트 연결 시 필요한 처리가 있으면 여기에 추가
  }

  async handleDisconnect(client: Socket) {
    await this.eventsService.handleDisconnect(client, this.server);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { roomId: number, username?: string }
  ): Promise<void> {
    const { roomId, username } = payload;
    await this.eventsService.handleJoinRoom(client, this.server, roomId, username);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { roomId: number }
  ): Promise<void> {
    try {
      const { roomId } = payload;
      
      // 사용자가 해당 방에 있는지 확인
      if (client.data.roomId !== roomId) {
        client.emit('error', { message: '해당 방에 입장한 상태가 아닙니다.' });
        return;
      }
      
      await this.eventsService.handleLeaveRoom(client, this.server, roomId);
      
      // 사용자 데이터에서 방 정보 제거
      delete client.data.roomId;
      delete client.data.roomName;
      
      // 방 퇴장 확인 메시지 전송
      client.emit('leftRoom', { roomId });
    } catch (error) {
      client.emit('error', { message: '방 퇴장 중 오류가 발생했습니다.' });
    }
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { roomId: number, message: string }
  ): void {
    const { roomId, message } = payload;
    this.eventsService.handleSendMessage(client, this.server, roomId, message);
  }
}
