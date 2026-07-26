import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

export interface TenantFixture {
  email: string;
  password: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

/** Registrasi tenant baru dengan identitas unik (test tidak saling mengganggu). */
export async function registerTenant(app: INestApplication, label: string): Promise<TenantFixture> {
  const suffix = randomUUID().slice(0, 8);
  const email = `${label}-${suffix}@test.flowniaga.local`;
  const password = 'PasswordUjian123!';
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password,
      name: `Pemilik ${label}`,
      tenantName: `Tenant ${label} ${suffix}`,
      tenantSlug: `tenant-${label}-${suffix}`,
    })
    .expect(201);
  return {
    email,
    password,
    tenantId: res.body.tenantId,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    userId: res.body.user.id,
  };
}

export function authed(fixture: { accessToken: string; tenantId: string }) {
  return {
    Authorization: `Bearer ${fixture.accessToken}`,
    'x-tenant-id': fixture.tenantId,
  };
}
