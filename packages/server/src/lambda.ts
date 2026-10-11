import { handle } from '@hono/aws-lambda';
import type { MountedModule } from './app.ts';
import { buildApp } from './app.ts';
import { readConfig } from './config.ts';
import { createPublisher } from './publish.ts';
import { createAppSyncPublisher, createMemoryPublisher } from './realtime.ts';
import { createMemoryStateStore, createStateStore } from './room-state.ts';

/**
 * Lambda entry for an API group. Infra generates one entry per group that
 * imports its modules' routes and calls this.
 */
export function createApiHandler(modules: readonly MountedModule[]) {
  const config = readConfig();
  const state = config.ROOM_STATE_TABLE
    ? createStateStore(config.ROOM_STATE_TABLE)
    : createMemoryStateStore();
  const realtime = config.REALTIME_HTTP_HOST
    ? createAppSyncPublisher({ httpHost: config.REALTIME_HTTP_HOST, region: config.AWS_REGION })
    : createMemoryPublisher();
  const app = buildApp(modules, { config, state, publish: createPublisher({ state, realtime }) });
  return handle(app);
}
