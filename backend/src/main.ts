import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : '',
    methods: '*',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, Origin, X-Auth-Token',
    exposedHeaders: 'Content-Disposition, Content-Length, X-Total-Count',
    optionsSuccessStatus: 204,
    maxAge: 3600,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
