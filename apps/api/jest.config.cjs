/** Konfigurasi Jest: proyek `unit` (cepat, tanpa DB) dan `integration` (butuh PostgreSQL test). */
const base = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-env.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/jest-setup-timeout.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      slowTestThreshold: 15,
    },
  ],
};
