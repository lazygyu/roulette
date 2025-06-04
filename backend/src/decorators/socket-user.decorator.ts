import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { User } from '@prisma/client'; // Assuming User type is available from Prisma
import { AnonymousUser } from '../types/socket.d'; // AnonymousUser 인터페이스 임포트

/**
 * WebSocket 컨텍스트에서 인증된 사용자 또는 익명 사용자 정보를 추출하는 데코레이터입니다.
 * WsJwtAuthGuard와 함께 사용될 수 있습니다.
 */
export const SocketCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User | AnonymousUser | null => {
    const client = ctx.switchToWs().getClient<Socket>();
    return client.user;
  },
);
