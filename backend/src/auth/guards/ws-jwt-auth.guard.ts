import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Observable } from 'rxjs';
import { User } from '@prisma/client'; // Assuming User type is available

@Injectable()
export class WsJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * WebSocket 컨텍스트에서 요청 객체(Socket 클라이언트)를 반환합니다.
   * Passport 전략이 토큰을 찾을 위치를 지정합니다.
   */
  getRequest(context: ExecutionContext): Socket {
    return context.switchToWs().getClient<Socket>();
  }

  /**
   * 인증 성공/실패를 처리합니다.
   * 성공 시 사용자 정보를 소켓 객체에 첨부하고 반환합니다.
   * 실패 시 WsException을 발생시킵니다.
   */
  handleRequest<TUser = User>(err: any, user: TUser, info: any, context: ExecutionContext): TUser {
    if (err || !user) {
      // 토큰이 없거나 유효하지 않은 경우 WsException 발생
      const errorMessage = info instanceof Error ? info.message : 'Unauthorized';
      throw new WsException(errorMessage || 'Invalid token');
    }

    // 인증 성공 시 사용자 정보를 소켓 객체에 첨부
    const client = this.getRequest(context);
    (client as any).user = user; // Attach user to the socket instance

    return user;
  }

  /**
   * canActivate 메소드를 오버라이드하여 WsException을 처리하도록 합니다.
   * AuthGuard의 기본 canActivate는 HTTP 예외를 던지기 때문입니다.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
    // super.canActivate는 내부적으로 handleRequest를 호출합니다.
    // handleRequest에서 WsException을 던지므로, 여기서는 별도 처리가 필요 없을 수 있습니다.
    // 만약 super.canActivate가 다른 종류의 예외를 던진다면 여기서 catch하여 WsException으로 변환해야 합니다.
    // 예:
    // try {
    //   return super.canActivate(context);
    // } catch (e) {
    //   if (e instanceof UnauthorizedException) {
    //     throw new WsException('Unauthorized');
    //   }
    //   throw e; // 다른 예외는 그대로 던짐
    // }
  }
}
