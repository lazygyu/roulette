import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameSessionService } from './game-session.service'; // GameSessionService 임포트
import { GameEngineService } from './game-engine.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  // RoomManagerService를 GameSessionService로 변경
  providers: [GameGateway, GameSessionService, GameEngineService],
  exports: [GameSessionService], // GameSessionService export
})
export class GameModule {}
