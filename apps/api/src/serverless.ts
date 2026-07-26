import 'reflect-metadata';
import serverless from 'serverless-http';
import { createConfiguredApp } from './app-setup';

type ServerlessHandler = ReturnType<typeof serverless>;

let cachedHandler: ServerlessHandler | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (!cachedHandler) {
    // Semua route diprefix /api/backend agar cocok dengan path asli request
    // yang diteruskan redirect Netlify (cookie refresh: /api/backend/auth).
    const app = await createConfiguredApp({ globalPrefix: 'api/backend' });
    await app.init();
    const expressApp = app.getHttpAdapter().getInstance() as Parameters<typeof serverless>[0];
    cachedHandler = serverless(expressApp, {
      binary: ['multipart/form-data', 'application/octet-stream'],
    });
  }
  return cachedHandler;
}

/** Entrypoint Netlify Function — instance Nest di-cache antar-invocation. */
export const handler = async (event: unknown, context: unknown): Promise<unknown> => {
  try {
    const h = await getHandler();
    return await h(
      event as Parameters<ServerlessHandler>[0],
      context as Parameters<ServerlessHandler>[1],
    );
  } catch (error) {
    // Tanpa akses log platform, kegagalan bootstrap harus terlihat di response
    // (stack hanya bila DEBUG_BOOTSTRAP=1 agar tidak bocor di produksi normal).
    const err = error as Error;
    console.error('serverless bootstrap/handler error', err);
    cachedHandler = null;
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'BOOTSTRAP_ERROR',
          message: err?.message ?? String(error),
          stack: process.env.DEBUG_BOOTSTRAP === '1' ? err?.stack : undefined,
        },
      }),
    };
  }
};
