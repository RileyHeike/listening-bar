import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke tests. Locally they run against a `BAR_ENV=local` build (fixture
 * data, drafts visible) served by `astro preview`. In CI against a deployed
 * preview, set PLAYWRIGHT_BASE_URL and no local server starts.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const port = 4322;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: baseURL ?? `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  // --ignore-lock keeps `astro preview` in the foreground even when Astro
  // detects an AI agent (it would otherwise background itself).
  webServer: baseURL
    ? undefined
    : {
        command: `BAR_ENV=local pnpm build && pnpm exec astro preview --port ${port} --ignore-lock`,
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
