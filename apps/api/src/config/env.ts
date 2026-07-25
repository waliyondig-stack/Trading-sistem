/** Akses environment terpusat dan tervalidasi ringan. Secret TIDAK pernah di-hardcode. */
export interface EnvConfig {
  nodeEnv: string;
  apiPort: number;
  corsOrigin: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtlDays: number;
  logLevel: string;
}

let cached: EnvConfig | null = null;

export function envConfig(): EnvConfig {
  if (cached) return cached;
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (nodeEnv === 'production' && (!accessSecret || !refreshSecret)) {
    throw new Error('JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET wajib diset di production.');
  }
  cached = {
    nodeEnv,
    apiPort: Number(process.env.API_PORT ?? 3001),
    corsOrigin: process.env.API_CORS_ORIGIN ?? 'http://localhost:3000',
    jwtAccessSecret: accessSecret ?? 'dev-only-change-me-access-secret-32ch',
    jwtRefreshSecret: refreshSecret ?? 'dev-only-change-me-refresh-secret-32c',
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    jwtRefreshTtlDays: Number((process.env.JWT_REFRESH_TTL ?? '30d').replace(/d$/, '')) || 30,
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
  return cached;
}
