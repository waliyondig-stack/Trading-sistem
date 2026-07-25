/** Global setup Jest (integration): jalankan migration pada database test. */
import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import path from 'node:path';

export default async function globalSetup(): Promise<void> {
  config({ path: path.resolve(__dirname, '../../../.env') });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_URL_TEST wajib diset untuk integration test.');
  }
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
