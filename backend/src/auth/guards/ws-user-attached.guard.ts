import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { User } from '@prisma/client'; // User 타입 임포트

@Injectable()
export class WsUserAttachedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 소켓 클라이언트에서 'user' 속성을 명시적으로 타입 정의하여 사용
    const client = context.switchToWs().getClient<Socket & { user?: User }>();
    if (!client.user) {
      // WsException을 사용하여 클라이언트에게 명확한 에러 메시지 전달
      throw new WsException('Unauthorized: User not found on socket. Connection might not have been properly authenticated.');
    }
    return true;
  }
}
