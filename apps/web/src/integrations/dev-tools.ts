import type { AstroIntegration } from 'astro';

export interface DevToolsOptions {
  /** Sandbox API origin when `pnpm dev` runs against a deployed sandbox. */
  sandboxApi: string | undefined;
}

/**
 * Dev-only tooling. Everything here is wired only for `astro dev`, so none
 * of it can reach a staging or production build:
 *  - the control panel (injected on every page),
 *  - /dev/primitives (every @bar/ui primitive in every lighting mode).
 *
 * It also decides, at build time, whether fixture data may ship: only in
 * dev and in `BAR_ENV=local` builds (local preview, E2E, Lighthouse).
 */
export function devTools({ sandboxApi }: DevToolsOptions): AstroIntegration {
  return {
    name: 'bar:dev-tools',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, injectScript, updateConfig }) => {
        const dev = command === 'dev';
        const barEnv = process.env.BAR_ENV ?? 'local';
        const devConfig = {
          apiBase: dev && sandboxApi ? '/api' : null,
          realtime:
            dev && sandboxApi && process.env.SANDBOX_REALTIME_HOST
              ? {
                  httpHost: process.env.SANDBOX_REALTIME_HTTP_HOST ?? '',
                  realtimeHost: process.env.SANDBOX_REALTIME_HOST,
                  authToken: process.env.SANDBOX_REALTIME_TOKEN ?? '',
                }
              : null,
        };
        updateConfig({
          vite: {
            define: {
              'import.meta.env.BAR_FIXTURES': JSON.stringify(dev || barEnv === 'local'),
              'import.meta.env.BAR_DEV_CONFIG': JSON.stringify(dev ? devConfig : null),
            },
          },
        });
        if (!dev) return;
        injectRoute({ pattern: '/dev/primitives', entrypoint: './src/dev/primitives.astro' });
        injectScript('page', `import '/src/dev/control-panel/mount.ts';`);
      },
    },
  };
}
