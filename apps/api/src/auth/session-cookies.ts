import type { CookieOptions, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { envConfig } from '../config/env';

/**
 * Session cookie web (ADR-005):
 * - access & refresh token di cookie httpOnly (tidak dapat dibaca JavaScript);
 * - SameSite=Lax; Secure di production;
 * - CSRF token di cookie non-httpOnly (double-submit: JS membacanya dan
 *   mengirim ulang lewat header x-csrf-token pada request mutasi).
 */
export const ACCESS_COOKIE = 'fn_access';
export const REFRESH_COOKIE = 'fn_refresh';
export const CSRF_COOKIE = 'fn_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: envConfig().nodeEnv === 'production',
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): string {
  const env = envConfig();
  const refreshMaxAgeMs = env.jwtRefreshTtlDays * 24 * 60 * 60 * 1000;
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: ACCESS_MAX_AGE_MS,
  });
  // Refresh cookie hanya dikirim ke endpoint auth (memperkecil permukaan serangan).
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    path: env.refreshCookiePath,
    maxAge: refreshMaxAgeMs,
  });
  const csrfToken = randomBytes(24).toString('base64url');
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseOptions(),
    httpOnly: false, // sengaja: dibaca JS untuk double-submit
    maxAge: refreshMaxAgeMs,
  });
  return csrfToken;
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions() });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: envConfig().refreshCookiePath });
  res.clearCookie(CSRF_COOKIE, { ...baseOptions(), httpOnly: false });
}
