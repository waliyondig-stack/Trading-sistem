import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { envConfig } from './config/env';

export interface CreateAppOptions {
  /** Prefix semua route (tanpa slash awal), mis. `api/backend` untuk serverless. */
  globalPrefix?: string;
}

/**
 * Membangun aplikasi Nest dengan seluruh konfigurasi runtime (helmet, cookie,
 * CORS, validation) tanpa memanggil listen — dipakai bersama oleh entrypoint
 * server biasa (main.ts) dan serverless (serverless.ts).
 */
export async function createConfiguredApp(
  options: CreateAppOptions = {},
): Promise<NestExpressApplication> {
  const env = envConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  if (options.globalPrefix) {
    app.setGlobalPrefix(options.globalPrefix);
  }

  // Di balik reverse proxy (Netlify/Render/nginx): percayai X-Forwarded-* agar
  // req.ip benar dan cookie Secure berfungsi.
  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'x-tenant-id',
      'x-correlation-id',
      'x-csrf-token',
      'idempotency-key',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  return app;
}
