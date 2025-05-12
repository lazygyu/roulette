import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomManagerService } from './room-manager.service';
import { GameEngineService } from './game-engine.service'; // GameEngineService 임포트
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  // GameEngineService를 providers에 추가
  providers: [GameGateway, RoomManagerService, GameEngineService],
  exports: [RoomManagerService], // 필요하다면 GameEngineService도 export 할 수 있음
})
export class GameModule {}
