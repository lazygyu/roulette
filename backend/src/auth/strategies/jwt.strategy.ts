import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { Socket } from 'socket.io'; // Import Socket type

// Custom extractor for WebSocket handshake auth and HTTP header
const jwtFromRequestExtractor = (req: any): string | null => {
  let token: string | null = null;

  // 1. Try extracting from WebSocket handshake auth
  if (req instanceof Socket && req.handshake?.auth?.token) {
    token = req.handshake.auth.token;
  }

  // 2. Fallback to Authorization header (for HTTP requests)
  if (!token && req.headers) { // Check if req looks like an HTTP request
     try {
       token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
     } catch (e) {
       // Ignore if header is not present or malformed for HTTP
     }
  }

  // 3. Add other extraction methods if needed (e.g., cookies)

  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
    }

    super({
      jwtFromRequest: jwtFromRequestExtractor, // Use the custom extractor
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('인증이 유효하지 않습니다.');
    }
    // Return user object without password
    const { password, ...result } = user;
    return result;
  }
}
