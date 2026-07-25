/**
 * Acceptance test: alur autentikasi dan lifecycle sesi.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authed, createTestApp, registerTenant, TenantFixture } from './helpers';

describe('Auth', () => {
  let app: INestApplication;
  let fixture: TenantFixture;

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await registerTenant(app, 'auth');
  });

  afterAll(async () => {
    await app.close();
  });

  it('menolak kata sandi salah dengan pesan generik', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: 'salah-besar' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('login valid mengembalikan token + membership', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.memberships[0].tenantId).toBe(fixture.tenantId);
    expect(res.body.memberships[0].roleName).toBe('Owner');
  });

  it('refresh token dirotasi: token lama tidak bisa dipakai ulang', async () => {
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: fixture.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    const reuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: fixture.refreshToken })
      .expect(401);
    expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('/auth/me mengembalikan profil tanpa header tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set({ Authorization: `Bearer ${fixture.accessToken}` })
      .expect(200);
    expect(res.body.user.email).toBe(fixture.email);
  });

  it('request tanpa token ditolak 401', async () => {
    await request(app.getHttpServer()).get('/branches').expect(401);
  });

  it('payload tidak dikenal ditolak oleh validation (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/branches')
      .set(authed(fixture))
      .send({ code: 'OK-01', name: 'Valid', extraBerbahaya: true })
      .expect(400);
  });
});
