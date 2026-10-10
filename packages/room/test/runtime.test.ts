import { newEventId, registry } from '@bar/core';
import { atom } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, createApiClient } from '../src/api.ts';
import { createDispatcher } from '../src/events.ts';
import { readPageDomains, refetchOnReconnect } from '../src/runtime.ts';
import { loadSnapshot } from '../src/snapshot.ts';
import type { LiveStatus } from '../src/stores.ts';
import { $snapshotStatus } from '../src/stores.ts';
import { createSubscriptions } from '../src/subscriptions.ts';
import { createLocalTransport } from '../src/transport/local.ts';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const track = (title: string, at: string) => ({
  id: newEventId(),
  type: 'track.changed',
  v: 1,
  at,
  source: 'test',
  data: { source: 'Turntable', title, artist: 'A' },
});

describe('reconnect → snapshot refetch', () => {
  it('fetches the snapshot on every transition to open', () => {
    const status = atom<LiveStatus>('connecting');
    const fetchSnapshot = vi.fn();
    refetchOnReconnect(status, fetchSnapshot);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    status.set('open');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    status.set('open');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    status.set('offline');
    status.set('connecting');
    status.set('open');
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it('fetches once when there is no transport', () => {
    const fetchSnapshot = vi.fn();
    refetchOnReconnect(null, fetchSnapshot);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('fetches immediately when the transport is already open', () => {
    const fetchSnapshot = vi.fn();
    refetchOnReconnect(atom<LiveStatus>('open'), fetchSnapshot);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('loadSnapshot', () => {
  it('dispatches API envelopes oldest first and skips bad ones', async () => {
    const room = createDispatcher(registry as never, () => undefined);
    const seen: string[] = [];
    room.subscribe(['track.changed'], (e) => seen.push((e.data as { title: string }).title));
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        events: [
          track('newer', '2026-01-01T00:00:02Z'),
          { broken: true },
          track('older', '2026-01-01T00:00:01Z'),
        ],
      }),
    );
    const ok = await loadSnapshot({ api: createApiClient('/api', fetchImpl) }, room);
    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/room/snapshot',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(seen).toEqual(['older', 'newer']);
    expect($snapshotStatus.get()).toBe('ready');
  });

  it('uses fixtures when no API is configured', async () => {
    const room = createDispatcher(registry as never, () => undefined);
    const fixtures = vi.fn(() => [track('fixture', '2026-01-01T00:00:00Z')]);
    await loadSnapshot({ api: createApiClient(null), fixtures }, room);
    expect(room.latest('track.changed')).toBeDefined();
  });

  it('reports errors without throwing', async () => {
    $snapshotStatus.set('idle');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const room = createDispatcher(registry as never, () => undefined);
    const api = createApiClient('/api', async () =>
      jsonResponse({ error: { code: 'x', message: 'y' } }, 500),
    );
    expect(await loadSnapshot({ api }, room)).toBe(false);
    expect($snapshotStatus.get()).toBe('error');
    warn.mockRestore();
  });
});

describe('api client', () => {
  it('surfaces API error codes and messages', async () => {
    const api = createApiClient('/api', async () =>
      jsonResponse({ error: { code: 'not_found', message: 'No such thing.' } }, 404),
    );
    await expect(api.request('GET /room/snapshot')).rejects.toThrow(ApiClientError);
    await expect(api.request('GET /room/snapshot')).rejects.toThrow(
      /404 not_found\): No such thing/,
    );
  });

  it('validates responses', async () => {
    const api = createApiClient('/api', async () => jsonResponse({ nope: 1 }));
    await expect(api.request('GET /room/snapshot')).rejects.toThrow(/bad_response/);
  });

  it('sends JSON bodies', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'x' }));
    await createApiClient('/api/', fetchImpl).request('POST /room/dev/publish', {
      type: 'track.stopped',
      data: {},
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/room/dev/publish',
      expect.objectContaining({ method: 'POST', body: '{"type":"track.stopped","data":{}}' }),
    );
  });

  it('refuses requests when no API is configured', async () => {
    await expect(createApiClient(null).request('GET /room/snapshot')).rejects.toThrow(/no_api/);
  });
});

describe('subscriptions', () => {
  it('subscribes and unsubscribes only the difference', () => {
    const transport = createLocalTransport();
    const subscribe = vi.spyOn(transport, 'subscribe');
    const received = vi.fn();
    const subscriptions = createSubscriptions([transport], received);
    subscriptions.update(['music', 'weather']);
    subscriptions.update(['music', 'menu']);
    expect(subscribe.mock.calls.map(([domain]) => domain)).toEqual(['music', 'weather', 'menu']);
    expect(subscriptions.domains()).toEqual(['menu', 'music']);
    transport.publish('weather', { x: 1 });
    expect(received).not.toHaveBeenCalled();
    transport.publish('music', { x: 2 });
    expect(received).toHaveBeenCalledWith({ x: 2 });
  });

  it('reads page domains from the layout meta tag', () => {
    document.head.innerHTML = '<meta name="bar:domains" content="music  weather">';
    expect(readPageDomains()).toEqual(['music', 'weather']);
  });
});
