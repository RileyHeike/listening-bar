import { handle } from '@hono/aws-lambda';
import type { MountedModule } from './app.ts';
import { buildApp } from './app.ts';
import { serverRuntime } from './runtime.ts';

/**
 * Lambda entry for an API group. Infra generates one entry per group that
 * imports its modules' routes and calls this.
 */
export function createApiHandler(modules: readonly MountedModule[]) {
  return handle(buildApp(modules, serverRuntime()));
}
