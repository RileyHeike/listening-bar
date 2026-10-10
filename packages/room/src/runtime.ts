import type { ReadableAtom } from 'nanostores';
import { configureApi, createApiClient } from './api.ts';
import { syncRootAttributes } from './attributes.ts';
import type { AudioManager } from './audio.ts';
import { createAudioManager } from './audio.ts';
import { startClock } from './clock.ts';
import type { RealtimeConfig, RuntimeConfig } from './config.ts';
import type { Dispatcher } from './events.ts';
import { dispatcher } from './events.ts';
import { loadSnapshot } from './snapshot.ts';
import type { LiveStatus } from './stores.ts';
import { $live, $prefersReducedMotion, restorePreferences } from './stores.ts';
import { createSubscriptions } from './subscriptions.ts';
import { localBus } from './transport/local-bus.ts';
import type { Transport } from './transport/types.ts';

export interface RoomOptions {
  /** Owner's IANA time zone (PUBLIC_BAR_TIMEZONE). */
  timeZone: string;
  /** Endpoints, or how to load them (e.g. fetch /config.json). */
  config: RuntimeConfig | (() => Promise<RuntimeConfig>);
  /** Fixture snapshot for local dev when no API is configured. */
  fixtures?: (() => readonly unknown[] | Promise<readonly unknown[]>) | undefined;
  /** Builds the real-time transport (AppSync) when config provides one. */
  createTransport?: ((realtime: RealtimeConfig) => Transport) | undefined;
  /** Attach the in-browser bus (dev: control panel local mode). */
  localBus?: boolean | undefined;
}

export interface Room {
  dispatcher: Dispatcher;
  audio: AudioManager;
  /** Domains currently subscribed. */
  domains(): string[];
  stop(): void;
}

/** Domains the current page listens to, rendered by the layout as <meta name="bar:domains">. */
export function readPageDomains(doc: Document = document): string[] {
  const content = doc.querySelector('meta[name="bar:domains"]')?.getAttribute('content') ?? '';
  return content.split(/\s+/).filter(Boolean);
}

/**
 * Keep the snapshot fresh: fetch it whenever the primary transport (re)opens.
 * With no transport, fetch it once.
 */
export function refetchOnReconnect(
  status: ReadableAtom<LiveStatus> | null,
  fetchSnapshot: () => void,
): () => void {
  if (!status) {
    fetchSnapshot();
    return () => undefined;
  }
  let previous: LiveStatus | null = null;
  return status.subscribe((current) => {
    if (current === 'open' && previous !== 'open') fetchSnapshot();
    previous = current;
  });
}

declare global {
  interface Window {
    __barRoom?: Promise<Room>;
  }
}

/**
 * Start the room once per page load. The runtime persists across
 * client-router navigations (it is module state), so later calls return the
 * running room.
 */
export function startRoom(options: RoomOptions): Promise<Room> {
  window.__barRoom ??= boot(options);
  return window.__barRoom;
}

async function boot(options: RoomOptions): Promise<Room> {
  const cleanups: (() => void)[] = [];

  restorePreferences();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  $prefersReducedMotion.set(media.matches);
  const onMedia = (event: MediaQueryListEvent) => {
    $prefersReducedMotion.set(event.matches);
  };
  media.addEventListener('change', onMedia);
  cleanups.push(() => {
    media.removeEventListener('change', onMedia);
  });
  cleanups.push(syncRootAttributes(), startClock(options.timeZone));

  const audio = createAudioManager();
  cleanups.push(audio.start());

  const config = typeof options.config === 'function' ? await options.config() : options.config;
  const api = createApiClient(config.apiBase);
  configureApi(api);

  const transports: Transport[] = [];
  if (config.realtime && options.createTransport) {
    transports.push(options.createTransport(config.realtime));
  }
  if (options.localBus) transports.push(localBus());
  const primary = transports[0];
  if (primary) {
    cleanups.push(
      primary.status.subscribe((status) => {
        $live.set(status);
      }),
    );
  } else {
    $live.set('offline');
  }

  const subscriptions = createSubscriptions(transports, (raw) => dispatcher.dispatch(raw, 'live'));
  const follow = () => {
    subscriptions.update(readPageDomains());
  };
  follow();
  document.addEventListener('astro:page-load', follow);
  cleanups.push(() => {
    document.removeEventListener('astro:page-load', follow);
    subscriptions.clear();
  });

  cleanups.push(
    refetchOnReconnect(primary?.status ?? null, () => {
      void loadSnapshot({ api, fixtures: options.fixtures }, dispatcher);
    }),
  );

  return {
    dispatcher,
    audio,
    domains: () => subscriptions.domains(),
    stop() {
      for (const cleanup of cleanups.reverse()) cleanup();
    },
  };
}
