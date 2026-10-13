import { defineConfig, devices } from '@playwright/test';

/**
 * Visual capture: deterministic screenshots of every page for comparison
 * against `main` (`visual/compare.ts`). Always runs against a local
 * `BAR_ENV=local` build so fixtures, not live data, fill the room.
 * Screenshots land in visual-results/current/<project>/<name>.png.
 */
const port = 4323;

export default defineConfig({
  testDir: 'visual',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    reducedMotion: 'reduce',
    timezoneId: 'America/Los_Angeles',
    locale: 'en-US',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `BAR_ENV=local pnpm build && pnpm exec astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
