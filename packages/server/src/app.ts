import type { Snapshot } from '@bar/core';
import { DevPublishRequestSchema, EventDataError, PLATFORM_MODULE_NAME } from '@bar/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ServerConfig } from './config.ts';
import { ApiError, errorBody } from './errors.ts';
import { logger } from './logger.ts';
import type { Publish } from './publish.ts';
import type { StateStore } from './room-state.ts';
import { readJson } from './validate.ts';

/** A module's routes, mounted at /api/<name>. */
export interface MountedModule {
  name: string;
  routes: (app: Hono) => void;
}

export interface AppDeps {
  config: ServerConfig;
  state: StateStore;
  publish: Publish;
}

/**
 * The API: platform routes under /api/room plus every module's routes under
 * /api/<module>. Errors always come back as { error: { code, message } }.
 */
export function buildApp(modules: readonly MountedModule[], deps: AppDeps): Hono {
  const app = new Hono().basePath('/api');

  if (deps.config.allowedOrigins.length > 0) {
    app.use('*', cors({ origin: deps.config.allowedOrigins, allowMethods: ['GET', 'POST'] }));
  }

  app.get('/room/snapshot', async (c) => {
    const body: Snapshot = { events: await deps.state.list() };
    c.header('cache-control', 'no-store');
    return c.json(body);
  });

  if (deps.config.devRoutes) {
    app.post('/room/dev/publish', async (c) => {
      const { type, data } = await readJson(c, DevPublishRequestSchema);
      try {
        const envelope = await deps.publish(type, data as never, { source: 'control-panel' });
        return c.json({ id: envelope.id });
      } catch (error) {
        if (error instanceof EventDataError)
          throw new ApiError(400, 'invalid_event', error.message);
        throw error;
      }
    });
  }

  for (const module of modules) {
    if (module.name === PLATFORM_MODULE_NAME) {
      throw new Error(`Module name "${PLATFORM_MODULE_NAME}" is reserved for platform routes.`);
    }
    const sub = new Hono();
    module.routes(sub);
    app.route(`/${module.name}`, sub);
  }

  app.notFound((c) =>
    c.json(errorBody('not_found', `No route for ${c.req.method} ${c.req.path}.`), 404),
  );

  app.onError((error, c) => {
    if (error instanceof ApiError)
      return c.json(errorBody(error.code, error.message), error.status);
    logger.error('Unhandled API error', { error, path: c.req.path });
    return c.json(
      errorBody('internal', 'Something went wrong on our side. Try again shortly.'),
      500,
    );
  });

  return app;
}
