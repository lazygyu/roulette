import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // 실제 프로덕션 환경에서는 특정 출처만 허용하도록 변경해야 합니다.
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  constructor(private readonly logger: Logger) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // 예시: 'msgToServer' 이벤트를 수신하고 클라이언트에게 'msgToClient' 이벤트를 전송합니다.
  // 실제 구현에서는 이 부분을 필요에 맞게 수정해야 합니다.
  @SubscribeMessage('msgToServer')
  handleMessage(client: Socket, payload: string): void {
    this.logger.log(`Message from client ${client.id}: ${payload}`);
    // 모든 클라이언트에게 메시지 브로드캐스트
    // this.server.emit('msgToClient', payload);

    // 메시지를 보낸 클라이언트에게만 응답
    client.emit('msgToClient', `Server received your message: ${payload}`);
  }
}
