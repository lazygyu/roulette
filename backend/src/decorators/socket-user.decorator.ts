import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { User } from '@prisma/client'; // Assuming User type is available from Prisma

/**
 * WebSocket 컨텍스트에서 인증된 사용자 정보를 추출하는 데코레이터입니다.
 * WsJwtAuthGuard와 함께 사용되어야 합니다.
 */
export const SocketCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User | undefined => {
    const client = ctx.switchToWs().getClient<Socket & { user?: User }>();
    // WsJwtAuthGuard에서 user 객체를 소켓에 첨부했다고 가정합니다.
    return client.user;
  },
);
