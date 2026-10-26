import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['iPhone SE'], browserName: 'chromium', viewport: { width: 375, height: 667 } }, testIgnore: /desktop\.spec\.ts/ },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } }, testMatch: /desktop\.spec\.ts/ },
  ],
  // Runs the app in demo mode (no Supabase env) so tests use the built-in seed.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/home`,
    reuseExistingServer: true,
    timeout: 300_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', DM_ALLOW_RESET: '1' },
  },
});
