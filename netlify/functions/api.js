/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
// Netlify Function pembungkus API NestJS (hasil build tsc di apps/api/dist).
// Route asli /api/backend/* diteruskan ke sini oleh redirect di netlify.toml.
exports.handler = require('../../apps/api/dist/serverless').handler;
