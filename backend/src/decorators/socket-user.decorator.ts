import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { User } from '@prisma/client'; // User 타입을 임포트합니다. 실제 경로에 맞게 조정하세요.

/**
 * WebSocket 컨텍스트에서 현재 인증된 사용자 정보를 추출하는 데코레이터입니다.
 * WsJwtAuthGuard에 의해 소켓 객체에 'user' 속성으로 첨부된 사용자 정보를 반환합니다.
 * 사용자가 인증되지 않았거나 정보가 없는 경우 null을 반환할 수 있습니다.
 *
 * @example
 * ```ts
 * @SubscribeMessage('some_event')
 * handleSomeEvent(@SocketCurrentUser() user: User) {
 *   if (user) {
 *     console.log('Current user ID:', user.id);
 *   } else {
 *     // 사용자가 인증되지 않은 경우 처리
 *   }
 * }
 * ```
 */
export const SocketCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User | null => {
    const client = ctx.switchToWs().getClient<Socket>();
    // WsJwtAuthGuard에서 첨부한 사용자 정보 반환
    // 타입 단언을 사용하여 user 속성에 접근합니다. Guard에서 user를 설정하지 않으면 undefined가 됩니다.
    const user = (client as any).user as User | undefined;
    return user || null; // 사용자가 없으면 null 반환
  },
);
