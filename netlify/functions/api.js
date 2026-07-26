/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
// Netlify Function pembungkus API NestJS (hasil build tsc di apps/api/dist).
// Route asli /api/backend/* diteruskan ke sini oleh redirect di netlify.toml.
// Require dilakukan lambat + dibungkus try/catch agar kegagalan import
// (env kurang, modul hilang) terlihat sebagai respons 500, bukan crash runtime.
exports.handler = async (event, context) => {
  try {
    const { handler } = require('../../apps/api/dist/serverless');
    return await handler(event, context);
  } catch (e) {
    console.error('function init error', e);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'FUNCTION_INIT_ERROR',
          message: e && e.message,
          stack: process.env.DEBUG_BOOTSTRAP === '1' ? e && e.stack : undefined,
          envPresence:
            process.env.DEBUG_BOOTSTRAP === '1'
              ? {
                  nodeEnv: process.env.NODE_ENV,
                  jwtAccess: Boolean(process.env.JWT_ACCESS_SECRET),
                  jwtRefresh: Boolean(process.env.JWT_REFRESH_SECRET),
                  databaseUrl: Boolean(process.env.DATABASE_URL),
                  refreshCookiePath: process.env.REFRESH_COOKIE_PATH,
                }
              : undefined,
        },
      }),
    };
  }
};
