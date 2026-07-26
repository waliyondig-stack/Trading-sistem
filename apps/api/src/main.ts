import 'reflect-metadata';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getBrandConfig } from '@flowniaga/config';
import { createConfiguredApp } from './app-setup';
import { envConfig } from './config/env';

async function bootstrap(): Promise<void> {
  const env = envConfig();
  const brand = getBrandConfig();

  const app = await createConfiguredApp();
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
