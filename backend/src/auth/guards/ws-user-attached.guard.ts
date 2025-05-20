import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { User } from '@prisma/client'; // User 타입 임포트

@Injectable()
export class WsUserAttachedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>(); // 타입을 Socket으로 변경
    if (!client.user) {
      throw new WsException('Unauthorized: User not found on socket. Connection might not have been properly authenticated.');
    }
    return true;
  }
}
