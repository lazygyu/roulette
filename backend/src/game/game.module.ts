import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameSessionService } from './game-session.service'; // GameSessionService 임포트
import { GameEngineService } from './game-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // AuthModule 임포트
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard'; // WsJwtAuthGuard 임포트
import { RoomsModule } from '../rooms/rooms.module'; // RoomsModule 임포트 (RoomsService 사용 위해)

@Module({
  imports: [
    PrismaModule,
    AuthModule, // AuthModule 임포트하여 JwtService, UsersService 사용 가능하게 함
    RoomsModule, // RoomsModule 임포트하여 RoomsService 사용 가능하게 함
  ],
  // RoomManagerService를 GameSessionService로 변경
  // WsJwtAuthGuard를 providers에 추가
  providers: [GameGateway, GameSessionService, GameEngineService, WsJwtAuthGuard],
  exports: [GameSessionService], // GameSessionService export
})
export class GameModule {}
