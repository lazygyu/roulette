import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [UsersModule, AuthModule, RoomsModule, GameModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
