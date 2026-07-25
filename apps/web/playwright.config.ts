import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * E2E kritis FlowNiaga.
 * Prasyarat: PostgreSQL + Redis berjalan, database dev sudah
 * di-migrate + di-seed (akun demo owner@demo.flowniaga.local).
 * API & Web dinyalakan otomatis oleh webServer di bawah.
 */
const chromiumPath = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: existsSync(chromiumPath) ? { executablePath: chromiumPath } : {},
  },
  webServer: [
    {
      command: 'pnpm --filter @flowniaga/api dev',
      cwd: '../..',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @flowniaga/web start',
      cwd: '../..',
      url: 'http://localhost:3000/masuk',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
