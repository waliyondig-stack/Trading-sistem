/** Dimuat sebelum setiap file integration test: arahkan ke database TEST. */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../../.env') });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error('DATABASE_URL_TEST wajib diset untuk integration test.');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
