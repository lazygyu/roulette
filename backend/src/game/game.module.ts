import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomManagerService } from './room-manager.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GameGateway, RoomManagerService],
  exports: [RoomManagerService],
})
export class GameModule {}