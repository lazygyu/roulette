import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsGateway } from './events/events.gateway'; // EventsGateway 임포트

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, EventsGateway], // EventsGateway를 providers에 추가
})
export class AppModule {}
