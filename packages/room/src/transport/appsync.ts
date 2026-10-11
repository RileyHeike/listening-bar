import { realtimeChannel } from '@bar/core';
import { atom } from 'nanostores';
import type { RealtimeConfig } from '../config.ts';
import type { LiveStatus } from '../stores.ts';
import type { Transport } from './types.ts';

/**
 * AppSync Events WebSocket transport (docs: "Understanding the Event API
 * WebSocket protocol"). One connection; one subscription per domain on
 * that domain's channel. Reconnects with jittered exponential backoff and
 * re-subscribes everything; every transition to "open" makes the runtime
 * re-fetch the snapshot first.
 */

type Listener = (envelope: unknown) => void;

interface Subscription {
  id: string;
  listeners: Set<Listener>;
}

interface ServerMessage {
  type: string;
  id?: string;
  connectionTimeoutMs?: number;
  event?: unknown;
  errors?: { errorType?: string; message?: string }[];
}

export interface AppSyncTransportOptions {
  WebSocket?: typeof WebSocket;
  /** Backoff bounds in ms. */
  minDelay?: number;
  maxDelay?: number;
  random?: () => number;
}

const PROTOCOL = 'aws-appsync-event-ws';
const DEFAULT_TIMEOUT_MS = 300_000;

const base64Url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** `data` messages carry the event as a JSON string, or a list of them. */
function decodeEvents(event: unknown): unknown[] {
  const raw: unknown[] = Array.isArray(event) ? (event as unknown[]) : [event];
  return raw.flatMap((item) => {
    if (typeof item !== 'string') return [item];
    try {
      return [JSON.parse(item) as unknown];
    } catch {
      console.warn('[room] Ignored a real-time event that is not JSON.');
      return [];
    }
  });
}

export function createAppSyncTransport(
  config: RealtimeConfig,
  options: AppSyncTransportOptions = {},
): Transport {
  const Socket = options.WebSocket ?? WebSocket;
  const minDelay = options.minDelay ?? 1000;
  const maxDelay = options.maxDelay ?? 30_000;
  const random = options.random ?? Math.random;
  const status = atom<LiveStatus>('connecting');
  const subscriptions = new Map<string, Subscription>();
  const authorization = { Authorization: config.authToken };

  let socket: WebSocket | null = null;
  let acknowledged = false;
  let attempt = 0;
  let nextId = 0;
  let keepAlive: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  const send = (message: object) => {
    if (socket?.readyState === Socket.OPEN) socket.send(JSON.stringify(message));
  };

  const subscribeMessage = (domain: string, subscription: Subscription) => ({
    type: 'subscribe',
    id: subscription.id,
    channel: realtimeChannel(domain),
    authorization,
  });

  const armKeepAlive = () => {
    clearTimeout(keepAlive);
    // No "ka" within the timeout: the connection is dead even if the socket says otherwise.
    keepAlive = setTimeout(() => socket?.close(), timeoutMs);
  };

  const scheduleReconnect = () => {
    clearTimeout(reconnectTimer);
    if (subscriptions.size === 0) return;
    const ceiling = Math.min(maxDelay, minDelay * 2 ** attempt);
    attempt++;
    reconnectTimer = setTimeout(connect, ceiling / 2 + (random() * ceiling) / 2);
  };

  function connect() {
    clearTimeout(reconnectTimer);
    if (socket) return;
    acknowledged = false;
    status.set('connecting');
    const header = base64Url(JSON.stringify({ host: config.httpHost, ...authorization }));
    const ws = new Socket(`wss://${config.realtimeHost}/event/realtime`, [
      PROTOCOL,
      `header-${header}`,
    ]);
    socket = ws;

    ws.addEventListener('open', () => {
      send({ type: 'connection_init' });
    });

    ws.addEventListener('message', (event: MessageEvent<string>) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      switch (message.type) {
        case 'connection_ack':
          acknowledged = true;
          attempt = 0;
          timeoutMs = message.connectionTimeoutMs ?? DEFAULT_TIMEOUT_MS;
          armKeepAlive();
          for (const [domain, subscription] of subscriptions)
            send(subscribeMessage(domain, subscription));
          status.set('open');
          break;
        case 'ka':
          armKeepAlive();
          break;
        case 'data': {
          const subscription = [...subscriptions.values()].find((s) => s.id === message.id);
          if (!subscription) break;
          for (const envelope of decodeEvents(message.event)) {
            for (const listener of subscription.listeners) listener(envelope);
          }
          break;
        }
        case 'subscribe_error':
        case 'broadcast_error':
        case 'error':
          console.warn(`[room] Real-time ${message.type}`, message.errors);
          break;
        default:
          break;
      }
    });

    ws.addEventListener('close', () => {
      clearTimeout(keepAlive);
      if (socket === ws) socket = null;
      acknowledged = false;
      status.set('offline');
      scheduleReconnect();
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (!socket && subscriptions.size > 0) {
        attempt = 0;
        connect();
      }
    });
  }

  return {
    status,
    subscribe(domain, onEnvelope) {
      let subscription = subscriptions.get(domain);
      if (!subscription) {
        subscription = { id: `bar-${domain}-${String(++nextId)}`, listeners: new Set() };
        subscriptions.set(domain, subscription);
        if (acknowledged) send(subscribeMessage(domain, subscription));
      }
      subscription.listeners.add(onEnvelope);
      if (!socket) connect();

      const current = subscription;
      return () => {
        current.listeners.delete(onEnvelope);
        if (current.listeners.size === 0 && subscriptions.get(domain) === current) {
          subscriptions.delete(domain);
          send({ type: 'unsubscribe', id: current.id });
        }
      };
    },
  };
}
