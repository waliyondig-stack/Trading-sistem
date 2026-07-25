/**
 * Acceptance test: session cookie httpOnly + CSRF (ADR-005).
 * - Login menghasilkan cookie httpOnly (bukan localStorage).
 * - Mutasi via cookie tanpa CSRF token ditolak.
 * - Logout mengakhiri session.
 * - Tenant context tetap divalidasi server-side.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, registerTenant, TenantFixture } from './helpers';

function extractCookies(res: request.Response): Record<string, string> {
  const raw = res.get('Set-Cookie') ?? [];
  const jar: Record<string, string> = {};
  for (const line of raw) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return jar;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

describe('Web session (cookie httpOnly + CSRF)', () => {
  let app: INestApplication;
  let fixture: TenantFixture;

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await registerTenant(app, 'sess');
  });

  afterAll(async () => {
    await app.close();
  });

  it('login menyetel cookie access/refresh httpOnly + cookie CSRF non-httpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const rawCookies = res.get('Set-Cookie') ?? [];
    const access = rawCookies.find((c) => c.startsWith('fn_access='));
    const refresh = rawCookies.find((c) => c.startsWith('fn_refresh='));
    const csrf = rawCookies.find((c) => c.startsWith('fn_csrf='));
    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(csrf).toBeDefined();
    expect(access!).toMatch(/HttpOnly/i);
    expect(refresh!).toMatch(/HttpOnly/i);
    expect(refresh!).toMatch(/Path=\/auth/i);
    expect(access!).toMatch(/SameSite=Lax/i);
    // CSRF sengaja BUKAN httpOnly (double-submit dibaca JS).
    expect(csrf!).not.toMatch(/HttpOnly/i);
  });

  it('cookie session dapat dipakai untuk request GET tanpa Bearer', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const jar = extractCookies(login);
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieHeader(jar))
      .expect(200);
    expect(res.body.user.email).toBe(fixture.email);
  });

  it('mutasi via cookie TANPA header CSRF ditolak (403 CSRF_TOKEN_INVALID)', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const jar = extractCookies(login);
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set('Cookie', cookieHeader(jar))
      .set('x-tenant-id', fixture.tenantId)
      .send({ code: 'CSRF-01', name: 'Cabang CSRF' })
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('mutasi via cookie DENGAN header CSRF yang cocok berhasil', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const jar = extractCookies(login);
    await request(app.getHttpServer())
      .post('/branches')
      .set('Cookie', cookieHeader(jar))
      .set('x-csrf-token', jar['fn_csrf'])
      .set('x-tenant-id', fixture.tenantId)
      .send({ code: 'CSRF-02', name: 'Cabang CSRF OK' })
      .expect(201);
  });

  it('klien Bearer (API) tidak diwajibkan CSRF', async () => {
    await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .set('x-tenant-id', fixture.tenantId)
      .send({ code: 'BEARER-01', name: 'Cabang Bearer' })
      .expect(201);
  });

  it('tenant context tetap divalidasi server-side pada session cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const jar = extractCookies(login);
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set('Cookie', cookieHeader(jar))
      .set('x-tenant-id', '22222222-2222-4222-8222-222222222222')
      .expect(403);
    expect(res.body.error.code).toBe('TENANT_ACCESS_DENIED');
  });

  it('logout mencabut refresh token dan menghapus cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const jar = extractCookies(login);

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${cookieHeader(jar)}; fn_refresh=${jar['fn_refresh'] ?? ''}`)
      .set('x-csrf-token', jar['fn_csrf'])
      .send({})
      .expect(204);
    const cleared = logoutRes.get('Set-Cookie') ?? [];
    expect(cleared.some((c) => c.startsWith('fn_access=;'))).toBe(true);

    // Refresh token yang dicabut tidak dapat dipakai lagi.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: jar['fn_refresh'] })
      .expect(401);
  });

  it('refresh via cookie merotasi token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.email, password: fixture.password })
      .expect(200);
    const jar = extractCookies(login);
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `fn_refresh=${jar['fn_refresh']}`)
      .send({})
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    // Token lama sudah dirotasi.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: jar['fn_refresh'] })
      .expect(401);
  });
});
