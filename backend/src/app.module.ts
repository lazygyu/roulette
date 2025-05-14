import { ClassSerializerInterceptor, Module, ValidationPipe } from '@nestjs/common';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';
import { APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';

@Module({
  imports: [UsersModule, AuthModule, RoomsModule, GameModule, PrismaModule],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => {
        return new ClassSerializerInterceptor(reflector, {
          strategy: 'excludeAll',
        });
      },
      inject: [Reflector],
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    },
  ],
})
export class AppModule {}
