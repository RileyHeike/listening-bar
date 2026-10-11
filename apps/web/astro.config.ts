import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import { BAR_ENVS } from '@bar/core';
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';
import { devTools } from './src/integrations/dev-tools.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/*
 * `pnpm dev` talks to the personal sandbox backend when `pnpm sandbox:deploy`
 * has written SANDBOX_API_URL to .env.local; the dev server proxies /api to it
 * so the browser stays same-origin. `pnpm dev:site` sets BAR_API=off and runs
 * on fixtures only.
 */
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const sandbox =
  process.env.BAR_API === 'off' || !env.SANDBOX_API_URL
    ? undefined
    : {
        api: env.SANDBOX_API_URL,
        realtime: env.SANDBOX_REALTIME_HOST
          ? {
              httpHost: env.SANDBOX_REALTIME_HTTP_HOST ?? '',
              realtimeHost: env.SANDBOX_REALTIME_HOST,
              authToken: env.SANDBOX_REALTIME_TOKEN ?? '',
            }
          : null,
      };

export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [react(), devTools({ sandbox })],
  env: {
    schema: {
      BAR_ENV: envField.enum({
        context: 'client',
        access: 'public',
        values: [...BAR_ENVS],
        default: 'local',
      }),
      PUBLIC_BAR_TIMEZONE: envField.string({
        context: 'client',
        access: 'public',
        default: 'America/Los_Angeles',
      }),
    },
  },
  vite: {
    server: {
      // Stations live outside the app (stations/*); let the dev server read them.
      fs: { allow: [repoRoot] },
      proxy: sandbox ? { '/api': { target: sandbox.api, changeOrigin: true } } : {},
    },
    resolve: {
      // One copy of React and of the room runtime's stores, however a package resolves them.
      dedupe: ['react', 'react-dom', 'nanostores'],
    },
  },
});
