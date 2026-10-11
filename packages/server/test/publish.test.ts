import { EventDataError, UnknownEventTypeError } from '@bar/core';
import { describe, expect, it, vi } from 'vitest';
import { handler as authorize, PUBLIC_REALTIME_TOKEN } from '../src/authorizer.ts';
import { createPublisher } from '../src/publish.ts';
import {
  RealtimePublishError,
  createAppSyncPublisher,
  createMemoryPublisher,
} from '../src/realtime.ts';
import { createMemoryStateStore, createStateStore } from '../src/room-state.ts';

describe('publish', () => {
  const setup = () => {
    const state = createMemoryStateStore();
    const realtime = createMemoryPublisher();
    return { state, realtime, publish: createPublisher({ state, realtime }) };
  };

  it('stores state events and broadcasts them on their domain channel', async () => {
    const { state, realtime, publish } = setup();
    const envelope = await publish('track.stopped', {}, { source: 'turntable' });
    expect(state.items.get('track.stopped')).toBe(envelope);
    expect(realtime.sent).toEqual([{ channel: '/music/room', envelope }]);
  });

  it('throws on invalid data or unregistered types, publishing nothing', async () => {
    const { realtime, publish } = setup();
    await expect(
      publish('weather.changed', { condition: 'hail' } as never, { source: 't' }),
    ).rejects.toThrow(EventDataError);
    await expect(publish('ghost.appeared' as never, {}, { source: 't' })).rejects.toThrow(
      UnknownEventTypeError,
    );
    expect(realtime.sent).toEqual([]);
  });
});

describe('AppSync publisher', () => {
  it('posts a signed request with the envelope as a JSON string', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ successful: [{}], failed: [] })),
    );
    const signer = {
      sign: vi.fn(async (request: { headers: Record<string, string> }) => ({
        ...request,
        headers: { ...request.headers, authorization: 'AWS4-HMAC-SHA256 …' },
      })),
    };
    const publisher = createAppSyncPublisher({
      httpHost: 'abc.appsync-api.us-west-2.amazonaws.com',
      region: 'us-west-2',
      fetch: fetchImpl,
      signer: signer as never,
    });
    await publisher.publish('/music/room', { id: 'x' });
    expect(signer.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        hostname: 'abc.appsync-api.us-west-2.amazonaws.com',
        path: '/event',
      }),
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://abc.appsync-api.us-west-2.amazonaws.com/event');
    expect(JSON.parse(init.body as string)).toEqual({
      channel: '/music/room',
      events: ['{"id":"x"}'],
    });
    expect((init.headers as Record<string, string>).authorization).toMatch(/^AWS4-HMAC-SHA256/);
  });

  it('reports rejected events', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ successful: [], failed: [{ index: 0 }] })),
    );
    const publisher = createAppSyncPublisher({
      httpHost: 'h',
      region: 'us-west-2',
      fetch: fetchImpl,
      signer: { sign: async (r: unknown) => r } as never,
    });
    await expect(publisher.publish('/music/room', {})).rejects.toThrow(RealtimePublishError);
  });
});

describe('room-state (DynamoDB)', () => {
  it('puts the envelope keyed by type and scans every page', async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = [];
    let page = 0;
    const documentClient = {
      send: vi.fn(
        async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
          sent.push({ name: command.constructor.name, input: command.input });
          if (command.constructor.name === 'ScanCommand') {
            page++;
            return page === 1
              ? {
                  Items: [{ type: 'a.b', envelope: { id: 1 }, _et: 'RoomState' }],
                  LastEvaluatedKey: { type: 'a.b' },
                }
              : { Items: [{ type: 'c.d', envelope: { id: 2 }, _et: 'RoomState' }] };
          }
          return {};
        },
      ),
    };
    const store = createStateStore('dev-test-room-state', documentClient as never);
    await store.put({ type: 'track.stopped', id: 'x' });
    expect(sent[0]).toMatchObject({
      name: 'PutCommand',
      input: {
        TableName: 'dev-test-room-state',
        Item: expect.objectContaining({
          type: 'track.stopped',
          envelope: { type: 'track.stopped', id: 'x' },
        }),
      },
    });
    expect(await store.list()).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('real-time authorizer', () => {
  it('admits the public token and nothing else', async () => {
    expect(await authorize({ authorizationToken: PUBLIC_REALTIME_TOKEN })).toMatchObject({
      isAuthorized: true,
    });
    expect(await authorize({ authorizationToken: 'guess' })).toMatchObject({ isAuthorized: false });
  });
});

describe('module-facing publish', () => {
  it('uses the shared runtime, which tests can replace', async () => {
    const {
      publish: modulePublish,
      setServerRuntime,
      readConfig,
    } = await import('../src/index.ts');
    const state = createMemoryStateStore();
    const realtime = createMemoryPublisher();
    setServerRuntime({
      config: readConfig({}),
      state,
      realtime,
      publish: createPublisher({ state, realtime }),
    });
    await modulePublish('track.stopped', {}, { source: 'plant-care' });
    expect(realtime.sent[0]?.channel).toBe('/music/room');
    setServerRuntime(undefined);
  });
});
