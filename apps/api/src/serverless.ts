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
  const h = await getHandler();
  return h(event as Parameters<ServerlessHandler>[0], context as Parameters<ServerlessHandler>[1]);
};
