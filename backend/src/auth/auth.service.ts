import { Injectable, UnauthorizedException, Logger } from '@nestjs/common'; // Logger 추가
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name); // Logger 인스턴스 생성

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('잘못된 비밀번호입니다.');
    }

    return user;
  }

  async login(user: User) {
    const payload = { username: user.username, sub: user.id, nickname: user.nickname }; // Add nickname to payload
    return {
      access_token: this.jwtService.sign(payload),
      nickname: user.nickname, // 사용자 닉네임을 응답에 추가
    };
  }

  async getUserFromToken(token: string): Promise<User | null> {
    if (!token) {
      this.logger.debug('Token not provided');
      return null;
    }
    try {
      // process.env.JWT_SECRET를 사용하여 토큰 검증
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      if (!payload || !payload.sub) {
        this.logger.warn('Invalid payload or missing user ID in token');
        return null;
      }
      // payload.sub (사용자 ID)를 사용하여 사용자 정보 조회
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        this.logger.warn(`User not found for ID: ${payload.sub}`);
        return null;
      }
      return user;
    } catch (error: any) { // error 타입을 any로 명시적 지정
      // 토큰이 유효하지 않거나 만료된 경우 등
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Token validation error: ${message}`);
      return null;
    }
  }
}
