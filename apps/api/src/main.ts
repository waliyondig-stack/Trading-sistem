import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { getBrandConfig } from '@flowniaga/config';
import { AppModule } from './app.module';
import { envConfig } from './config/env';

async function bootstrap(): Promise<void> {
  const env = envConfig();
  const brand = getBrandConfig();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

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
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${brand.appName} API`)
    .setDescription(
      `API ${brand.appName} — ${brand.tagline}. Endpoint tenant-scoped membutuhkan header x-tenant-id.`,
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: 'x-tenant-id',
      in: 'header',
      required: false,
      description: 'ID tenant aktif (wajib untuk endpoint tenant-scoped)',
      schema: { type: 'string', format: 'uuid' },
    })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: `${brand.appName} API Docs`,
  });

  await app.listen(env.apiPort);
}

void bootstrap();
