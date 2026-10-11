import { defineConfig } from 'vitest/config';

/** Runs integration/ against a deployed backend; see integration/preview.test.ts. */
export default defineConfig({
  test: { include: ['integration/**/*.test.ts'], testTimeout: 60_000 },
});
