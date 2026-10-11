import { newEventId } from '@bar/core';
import type { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.ts';
import { readConfig } from '../src/config.ts';
import { createPublisher } from '../src/publish.ts';
import { createMemoryPublisher } from '../src/realtime.ts';
import { createMemoryStateStore } from '../src/room-state.ts';

const setup = (
  env: Record<string, string> = {},
  modules: { name: string; routes: (app: Hono) => void }[] = [],
) => {
  const config = readConfig({ BAR_ENV: 'sandbox', ...env });
  const state = createMemoryStateStore();
  const realtime = createMemoryPublisher();
  const app = buildApp(modules, { config, state, publish: createPublisher({ state, realtime }) });
  return { app, state, realtime };
};

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('platform routes', () => {
  it('serves the snapshot from room-state', async () => {
    const { app, state } = setup();
    const envelope = {
      id: newEventId(),
      type: 'track.stopped',
      v: 1,
      at: new Date().toISOString(),
      source: 't',
      data: {},
    };
    await state.put(envelope);
    const response = await app.request('/api/room/snapshot');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ events: [envelope] });
  });

  it('hides the dev publish route unless enabled', async () => {
    const { app } = setup();
    const response = await app.request(
      '/api/room/dev/publish',
      json({ type: 'track.stopped', data: {} }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'No route for POST /api/room/dev/publish.' },
    });
  });

  it('never enables dev routes in production', () => {
    expect(readConfig({ BAR_ENV: 'production', DEV_ROUTES: 'enabled' }).devRoutes).toBe(false);
    expect(readConfig({ BAR_ENV: 'preview', DEV_ROUTES: 'enabled' }).devRoutes).toBe(true);
  });

  it('publishes through the dev route: stored and broadcast on the domain channel', async () => {
    const { app, state, realtime } = setup({ DEV_ROUTES: 'enabled' });
    const response = await app.request(
      '/api/room/dev/publish',
      json({ type: 'weather.changed', data: { condition: 'fog' } }),
    );
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(state.items.get('weather.changed')).toMatchObject({ id, source: 'control-panel' });
    expect(realtime.sent).toEqual([
      { channel: '/weather/room', envelope: expect.objectContaining({ id }) },
    ]);
  });

  it.each([
    ['an unregistered type', { type: 'ghost.appeared', data: {} }, 'invalid_request'],
    ['invalid data', { type: 'weather.changed', data: { condition: 'hail' } }, 'invalid_event'],
  ])('rejects %s with a specific error', async (_, body, code) => {
    const { app, realtime } = setup({ DEV_ROUTES: 'enabled' });
    const response = await app.request('/api/room/dev/publish', json(body));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(code);
    expect(realtime.sent).toEqual([]);
  });

  it('rejects malformed JSON', async () => {
    const { app } = setup({ DEV_ROUTES: 'enabled' });
    const response = await app.request('/api/room/dev/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{nope',
    });
    expect(await response.json()).toEqual({
      error: { code: 'invalid_json', message: 'The request body must be valid JSON.' },
    });
  });
});

describe('modules', () => {
  it('mounts module routes at /api/<name>', async () => {
    const { app } = setup({}, [
      { name: 'plants', routes: (sub) => sub.get('/', (c) => c.json({ ok: true })) },
    ]);
    expect(await (await app.request('/api/plants')).json()).toEqual({ ok: true });
  });

  it('refuses the reserved platform name', () => {
    expect(() => setup({}, [{ name: 'room', routes: () => undefined }])).toThrow(/reserved/);
  });

  it('turns unexpected errors into a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app } = setup({}, [
      {
        name: 'broken',
        routes: (sub) =>
          sub.get('/', () => {
            throw new Error('secret detail');
          }),
      },
    ]);
    const response = await app.request('/api/broken');
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('secret detail');
  });
});

describe('cors', () => {
  it('allows configured origins only', async () => {
    const { app } = setup({ ALLOWED_ORIGINS: 'https://pr-12.preview.example.com' });
    const allowed = await app.request('/api/room/snapshot', {
      headers: { origin: 'https://pr-12.preview.example.com' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://pr-12.preview.example.com',
    );
    const other = await app.request('/api/room/snapshot', {
      headers: { origin: 'https://evil.example' },
    });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});
