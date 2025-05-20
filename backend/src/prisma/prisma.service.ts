import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
  }

  async onModuleInit() {
    // 모듈 초기화 시 Prisma에 연결합니다.
    await this.$connect();
  }

  async onModuleDestroy() {
    // 애플리케이션 종료 시 Prisma 연결을 끊습니다.
    await this.$disconnect();
  }

  // NestJS v7 이하를 사용하는 경우, main.ts에서 enableShutdownHooks를 사용해야 합니다.
  // async enableShutdownHooks(app: INestApplication) {
  //   this.$on('beforeExit', async () => {
  //     await app.close();
  //   });
  // }
}
