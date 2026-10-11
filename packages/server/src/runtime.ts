import type { ServerConfig } from './config.ts';
import { readConfig } from './config.ts';
import type { Publish } from './publish.ts';
import { createPublisher } from './publish.ts';
import type { RealtimePublisher } from './realtime.ts';
import { createAppSyncPublisher, createMemoryPublisher } from './realtime.ts';
import type { StateStore } from './room-state.ts';
import { createMemoryStateStore, createStateStore } from './room-state.ts';

/**
 * The process-wide server runtime, built from the environment infra sets on
 * every Lambda (API groups and jobs) the first time it is needed. Without
 * those variables (tests, local runs) it uses in-memory stand-ins.
 */
export interface ServerRuntime {
  config: ServerConfig;
  state: StateStore;
  realtime: RealtimePublisher;
  publish: Publish;
}

let current: ServerRuntime | undefined;

export function serverRuntime(): ServerRuntime {
  if (current) return current;
  const config = readConfig();
  const state = config.ROOM_STATE_TABLE
    ? createStateStore(config.ROOM_STATE_TABLE)
    : createMemoryStateStore();
  const realtime = config.REALTIME_HTTP_HOST
    ? createAppSyncPublisher({ httpHost: config.REALTIME_HTTP_HOST, region: config.AWS_REGION })
    : createMemoryPublisher();
  current = { config, state, realtime, publish: createPublisher({ state, realtime }) };
  return current;
}

/** Replace the runtime (tests). Pass undefined to rebuild from the environment. */
export function setServerRuntime(runtime: ServerRuntime | undefined): void {
  current = runtime;
}

/**
 * Publish an event from module code (routes or jobs). The only way to
 * publish: validates against the registry, stores state events, broadcasts.
 */
export const publish: Publish = (type, data, options) =>
  serverRuntime().publish(type, data, options);
