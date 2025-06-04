import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameSessionService } from './game-session.service'; // GameSessionService 임포트
import { GameEngineService } from './game-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RoomsModule } from '../rooms/rooms.module'; // RoomsModule 임포트 추가
import { AuthModule } from 'src/auth/auth.module';
import { GamePersistenceService } from './game-persistence.service'; // GamePersistenceService 임포트
import {
  GameConnectionHandler,
  GameConfigHandler,
  GameControlHandler,
  GameSkillHandler,
} from './handlers';
import { ManagerOnlyGuard } from './guards'; // ManagerOnlyGuard 임포트 추가

@Module({
  imports: [PrismaModule, RoomsModule, AuthModule], // RoomsModule 임포트 배열에 추가
  // RoomManagerService를 GameSessionService로 변경
  providers: [
    GameGateway,
    GameSessionService,
    GameEngineService,
    GamePersistenceService,
    GameConnectionHandler,
    GameConfigHandler,
    GameControlHandler,
    GameSkillHandler,
    ManagerOnlyGuard, // ManagerOnlyGuard를 providers에 추가
  ],
  exports: [GameSessionService], // GameSessionService export
})
export class GameModule {}
