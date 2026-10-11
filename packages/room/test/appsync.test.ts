import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppSyncTransport } from '../src/transport/appsync.ts';

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {
    super();
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
  // Test helpers: drive the server side.
  serverOpen() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  serverSend(message: object) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
}

const config = {
  httpHost: 'abc.appsync-api.us-west-2.amazonaws.com',
  realtimeHost: 'abc.appsync-realtime-api.us-west-2.amazonaws.com',
  authToken: 'listening-bar-public',
};

const setup = () =>
  createAppSyncTransport(config, {
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    random: () => 1,
    minDelay: 1000,
  });

const connectAndAck = (socket: FakeSocket) => {
  socket.serverOpen();
  socket.serverSend({ type: 'connection_ack', connectionTimeoutMs: 300_000 });
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AppSync transport', () => {
  it('connects with the protocol and an encoded authorization header', () => {
    setup().subscribe('music', vi.fn());
    const socket = FakeSocket.instances[0]!;
    expect(socket.url).toBe(`wss://${config.realtimeHost}/event/realtime`);
    expect(socket.protocols[0]).toBe('aws-appsync-event-ws');
    const header = socket.protocols[1]!.replace(/^header-/, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    expect(JSON.parse(atob(header))).toEqual({
      host: config.httpHost,
      Authorization: config.authToken,
    });
  });

  it('initializes, subscribes per domain after ack, and reports open', () => {
    const transport = setup();
    transport.subscribe('music', vi.fn());
    transport.subscribe('weather', vi.fn());
    const socket = FakeSocket.instances[0]!;
    expect(transport.status.get()).toBe('connecting');
    connectAndAck(socket);
    expect(transport.status.get()).toBe('open');
    expect(socket.sent).toEqual([
      { type: 'connection_init' },
      {
        type: 'subscribe',
        id: 'bar-music-1',
        channel: '/music/room',
        authorization: { Authorization: config.authToken },
      },
      {
        type: 'subscribe',
        id: 'bar-weather-2',
        channel: '/weather/room',
        authorization: { Authorization: config.authToken },
      },
    ]);
  });

  it('delivers decoded events to the right domain', () => {
    const transport = setup();
    const music = vi.fn();
    const weather = vi.fn();
    transport.subscribe('music', music);
    transport.subscribe('weather', weather);
    const socket = FakeSocket.instances[0]!;
    connectAndAck(socket);
    socket.serverSend({ type: 'data', id: 'bar-music-1', event: JSON.stringify({ id: 'a' }) });
    socket.serverSend({ type: 'data', id: 'bar-music-1', event: [JSON.stringify({ id: 'b' })] });
    expect(music.mock.calls).toEqual([[{ id: 'a' }], [{ id: 'b' }]]);
    expect(weather).not.toHaveBeenCalled();
  });

  it('unsubscribes when the last listener leaves', () => {
    const transport = setup();
    const stop = transport.subscribe('music', vi.fn());
    const socket = FakeSocket.instances[0]!;
    connectAndAck(socket);
    stop();
    expect(socket.sent.at(-1)).toEqual({ type: 'unsubscribe', id: 'bar-music-1' });
  });

  it('reconnects with backoff and re-subscribes, reporting offline then open', () => {
    const transport = setup();
    transport.subscribe('music', vi.fn());
    connectAndAck(FakeSocket.instances[0]!);
    const statuses: string[] = [];
    transport.status.listen((s) => statuses.push(s));

    FakeSocket.instances[0]!.close();
    expect(transport.status.get()).toBe('offline');
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    const second = FakeSocket.instances[1]!;
    connectAndAck(second);
    expect(second.sent.map((m) => m.type)).toEqual(['connection_init', 'subscribe']);
    expect(statuses).toEqual(['offline', 'connecting', 'open']);
  });

  it('treats a missing keep-alive as a dead connection', () => {
    const transport = setup();
    transport.subscribe('music', vi.fn());
    const socket = FakeSocket.instances[0]!;
    socket.serverOpen();
    socket.serverSend({ type: 'connection_ack', connectionTimeoutMs: 5000 });
    vi.advanceTimersByTime(4000);
    socket.serverSend({ type: 'ka' });
    vi.advanceTimersByTime(4000);
    expect(transport.status.get()).toBe('open');
    vi.advanceTimersByTime(1001);
    expect(transport.status.get()).toBe('offline');
  });
});
