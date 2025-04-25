import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

/**
 * Request에서 인증된 사용자 정보를 추출하는 데코레이터
 *
 * 사용 예시:
 * @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest();

  // request에 user가 없는 경우 undefined를 반환합니다
  // 이 경우 컨트롤러에서 적절히 처리해야 합니다
  return request.user;
});
