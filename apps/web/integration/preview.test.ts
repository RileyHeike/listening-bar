/**
 * Integration tests against a deployed backend (PR previews in CI).
 * Real DynamoDB and AppSync: publish through the dev route, read it back
 * from the snapshot, and receive it live over the real-time transport.
 *
 *   BAR_API_URL=… BAR_REALTIME_HTTP_HOST=… BAR_REALTIME_HOST=… \
 *   BAR_REALTIME_TOKEN=… pnpm test:integration
 */
import { registry } from '@bar/core';
import { createApiClient, createAppSyncTransport } from '@bar/room';
import { describe, expect, it } from 'vitest';

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} to run integration tests.`);
  return value;
};

const api = createApiClient(`${env('BAR_API_URL').replace(/\/$/, '')}/api`);
const realtime = {
  httpHost: env('BAR_REALTIME_HTTP_HOST'),
  realtimeHost: env('BAR_REALTIME_HOST'),
  authToken: env('BAR_REALTIME_TOKEN'),
};

describe('deployed backend', () => {
  it('serves a valid snapshot', async () => {
    const { events } = await api.request('GET /room/snapshot');
    for (const envelope of events) expect(registry.receive(envelope).ok).toBe(true);
  });

  it('publishes a state event into the snapshot and delivers it live', async () => {
    const transport = createAppSyncTransport(realtime);
    const received = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('No live event within 15s.'));
      }, 15_000);
      transport.subscribe('menu', (envelope) => {
        clearTimeout(timer);
        resolve(envelope);
      });
    });
    await new Promise<void>((resolve) => {
      const stop = transport.status.subscribe((status) => {
        if (status === 'open') {
          resolve();
          queueMicrotask(() => {
            stop();
          });
        }
      });
    });

    const data = Object.fromEntries(
      ['onRotation', 'reading', 'growing', 'learning', 'building', 'drinking'].map((row) => [
        row,
        `[integration ${row}]`,
      ]),
    );
    const { id } = await api.request('POST /room/dev/publish', { type: 'menu.updated', data });

    expect(await received).toMatchObject({ id, type: 'menu.updated' });
    const { events } = await api.request('GET /room/snapshot');
    expect(events).toContainEqual(expect.objectContaining({ id }));
  }, 30_000);
});
