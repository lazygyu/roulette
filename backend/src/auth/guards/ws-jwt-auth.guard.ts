import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { AuthService } from '../auth.service'; // AuthService 임포트
import { JwtService } from '@nestjs/jwt'; // JwtService 임포트
import { UsersService } from '../../users/users.service'; // UsersService 임포트

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {} // JwtService와 UsersService 주입

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromHandshake(client);

    if (!token) {
      this.logger.warn(`클라이언트 ${client.id}로부터 토큰을 찾을 수 없습니다.`);
      // 토큰이 없는 경우 연결을 거부할 수도 있지만,
      // 여기서는 일단 통과시키고 핸들러 레벨에서 @UseGuards를 적용하여
      // 인증이 필요한 작업만 보호하는 방식을 선택할 수 있습니다.
      // 또는 WsException을 던져 연결 자체를 막을 수도 있습니다.
      // 여기서는 예외를 던져 연결을 막겠습니다.
      throw new WsException('인증 토큰이 필요합니다.');
      // return false; // 또는 false 반환
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET, // 실제 환경 변수 사용
      });
      // 페이로드가 유효하면 사용자 정보를 조회하여 소켓에 첨부
      return this.attachUserToSocket(payload, client);
    } catch (error: unknown) {
      this.logger.error(`토큰 검증 실패: ${client.id}`, error instanceof Error ? error.stack : error);
      // WsException을 사용하여 클라이언트에게 오류 전달
      const message = error instanceof Error ? error.message : '유효하지 않은 토큰입니다.';
      throw new WsException(`인증 실패: ${message}`);
      // return false; // 또는 false 반환
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // 핸드셰이크 쿼리에서 토큰 추출 (예: ?token=xxx)
    const tokenFromQuery = client.handshake.query?.token;
    if (typeof tokenFromQuery === 'string' && tokenFromQuery) {
      return tokenFromQuery;
    }

    // 핸드셰이크 auth 객체에서 토큰 추출 (Socket.IO v3+ 권장 방식)
    const tokenFromAuth = client.handshake.auth?.token;
    if (typeof tokenFromAuth === 'string' && tokenFromAuth) {
      return tokenFromAuth;
    }

    // 핸드셰이크 헤더에서 토큰 추출 (일부 클라이언트 라이브러리에서 사용)
    // const authHeader = client.handshake.headers?.authorization;
    // if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    //   return authHeader.split(' ')[1];
    // }

    return null;
  }

  private async attachUserToSocket(payload: any, client: Socket): Promise<boolean> {
    try {
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        this.logger.warn(`토큰 페이로드(${payload.sub})에 해당하는 사용자를 찾을 수 없습니다: ${client.id}`);
        throw new WsException('사용자를 찾을 수 없습니다.');
        // return false;
      }
      // 사용자 정보를 소켓 객체에 할당 (주의: user 객체 전체를 넣으면 민감 정보 노출 가능성)
      // 필요한 정보만 선별하거나 DTO를 사용하는 것이 좋습니다.
      // 여기서는 일단 user 객체를 그대로 넣습니다.
      (client as any).user = user; // user 속성 추가
      this.logger.log(`사용자 ${user.username}(${user.id}) 인증 성공 및 소켓에 첨부: ${client.id}`);
      return true;
    } catch (error) {
      this.logger.error(`사용자 조회 또는 소켓 첨부 중 오류: ${client.id}`, error instanceof Error ? error.stack : error);
      const message = error instanceof Error ? error.message : '사용자 정보 처리 중 오류 발생';
      throw new WsException(`인증 처리 오류: ${message}`);
      // return false;
    }
  }
}
