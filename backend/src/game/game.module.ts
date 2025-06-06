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
import { ManagerOnlyGuard } from './guards';
import { ImpactSkillStrategy } from './strategies/impact.strategy';
import { DummyMarbleSkillStrategy } from './strategies/dummy-marble.strategy';

@Module({
  imports: [PrismaModule, RoomsModule, AuthModule],
  providers: [
    GameGateway,
    GameSessionService,
    GameEngineService,
    GamePersistenceService,
    GameConnectionHandler,
    GameConfigHandler,
    GameControlHandler,
    GameSkillHandler,
    ManagerOnlyGuard,
    ImpactSkillStrategy,
    DummyMarbleSkillStrategy,
  ],
  exports: [GameSessionService],
})
export class GameModule {}
