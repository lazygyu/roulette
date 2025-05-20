import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService],
  imports: [PrismaModule],
  exports: [RoomsService],
})
export class RoomsModule {} 