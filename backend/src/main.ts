import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  mkdirSync(join(process.cwd(), 'uploads', 'products'), { recursive: true });

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const originsEnv =
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const origin = originsEnv.includes(',')
    ? originsEnv.split(',').map((s) => s.trim())
    : originsEnv;
  app.enableCors({
    origin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API http://localhost:${port}`);
}
bootstrap();
