import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators';
import { CSRF_COOKIE, CSRF_HEADER } from './session-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteksi CSRF (double-submit cookie) — hanya berlaku untuk request yang
 * terautentikasi lewat cookie session. Klien API dengan header Authorization
 * Bearer tidak rentan CSRF sehingga tidak diwajibkan.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Hanya wajib bila autentikasi berasal dari cookie (bukan Bearer header).
    if (req.authVia !== 'cookie') return true;

    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    const headerRaw = req.headers[CSRF_HEADER];
    const headerToken = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_INVALID',
        message: 'Token CSRF tidak ada atau tidak cocok.',
      });
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
