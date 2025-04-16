import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { EventsService } from './events.service';

@Module({
  imports: [RoomsModule],
  providers: [EventsGateway, EventsService],
  exports: [EventsGateway],
})
export class EventsModule {} 