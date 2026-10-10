/**
 * Starts the room runtime once per page load. Bundled module scripts run
 * once even across client-router navigations, so the runtime (stores,
 * subscriptions, audio) persists for the whole visit.
 */
import { OFFLINE_CONFIG, fetchRuntimeConfig, startRoom } from '@bar/room';
import { PUBLIC_BAR_TIMEZONE } from 'astro:env/client';

const devConfig = import.meta.env.BAR_DEV_CONFIG;

void startRoom({
  timeZone: PUBLIC_BAR_TIMEZONE,
  // Deployed environments serve their endpoints as /config.json.
  config: devConfig ?? (import.meta.env.BAR_FIXTURES ? OFFLINE_CONFIG : fetchRuntimeConfig),
  fixtures: import.meta.env.BAR_FIXTURES
    ? async () => (await import('@bar/fixtures')).fixtureSnapshot()
    : undefined,
  localBus: import.meta.env.DEV,
});
