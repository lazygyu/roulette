import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
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
}
