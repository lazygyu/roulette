import { Module } from '@nestjs/common';
import { RoomManagerService } from './room-manager.service';
import { GameGateway } from './game.gateway';

@Module({
  providers: [RoomManagerService, GameGateway],
  exports: [RoomManagerService]
})
export class GameModule {}