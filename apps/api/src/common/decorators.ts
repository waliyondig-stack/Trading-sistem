import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@flowniaga/domain';
import type { Request } from 'express';
import type { RequestUser, TenantContext } from './request-types';

export const IS_PUBLIC_KEY = 'flowniaga:isPublic';
/** Endpoint tanpa autentikasi (login, register, health). Gunakan seminimal mungkin. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_AUTH_ONLY_KEY = 'flowniaga:isAuthOnly';
/** Endpoint yang butuh JWT tetapi di luar scope tenant (mis. /auth/me). */
export const AuthOnly = () => SetMetadata(IS_AUTH_ONLY_KEY, true);

export const REQUIRED_PERMISSIONS_KEY = 'flowniaga:requiredPermissions';
/**
 * Deklarasi permission yang wajib dimiliki membership aktif pada tenant
 * (header x-tenant-id). Endpoint tanpa deklarasi ini DAN tanpa
 * @Public/@AuthOnly akan DITOLAK (default deny).
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.user as RequestUser;
});

export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.tenantContext as TenantContext;
});
