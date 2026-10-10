import type { Envelope, EventRegistry, EventType } from '@bar/core';
import { compareEnvelopes, registry as defaultRegistry } from '@bar/core';
import type { ReadableAtom } from 'nanostores';
import { atom } from 'nanostores';

interface AnyEnvelope {
  id: string;
  type: string;
  v: number;
  at: string;
  source: string;
  data: unknown;
}
type Handler = (envelope: AnyEnvelope) => void;

export type DispatchOrigin = 'snapshot' | 'live';

export type DispatchResult = 'applied' | 'stale' | 'duplicate' | 'invalid';

export interface Dispatcher {
  /**
   * Validate, upcast, and deliver an envelope from the wire. State events
   * older than what the room already holds are dropped. Never throws.
   */
  dispatch(raw: unknown, origin: DispatchOrigin): DispatchResult;
  /**
   * Listen for envelopes of the given types. Latest state envelopes already
   * held are replayed first, oldest to newest.
   */
  subscribe(types: readonly string[], handler: Handler): () => void;
  /** Latest state envelope per type (what the snapshot would contain). */
  latest(type: string): AnyEnvelope | undefined;
  /** Forget all held state (tests, dev tools). */
  reset(): void;
}

// The concrete registry type does not matter here; envelopes are handled generically.
type LooseRegistry = Pick<EventRegistry<never>, 'receive' | 'has'> & {
  get(type: string): { kind: 'state' | 'moment' };
};

export function createDispatcher(
  registry: LooseRegistry,
  log: (message: string) => void = (message) => {
    console.warn(`[room] ${message}`);
  },
): Dispatcher {
  const handlers = new Map<string, Set<Handler>>();
  const latest = new Map<string, AnyEnvelope>();

  return {
    dispatch(raw, origin) {
      const result = registry.receive(raw);
      if (!result.ok) {
        log(`Dropped ${origin} envelope: ${result.error}`);
        return 'invalid';
      }
      const envelope = result.envelope as AnyEnvelope;
      if (registry.get(envelope.type).kind === 'state') {
        const held = latest.get(envelope.type);
        if (held?.id === envelope.id) return 'duplicate';
        if (held && compareEnvelopes(held, envelope) > 0) return 'stale';
        latest.set(envelope.type, envelope);
      }
      for (const handler of handlers.get(envelope.type) ?? []) {
        try {
          handler(envelope);
        } catch (error) {
          console.error(`[room] Handler for ${envelope.type} failed`, error);
        }
      }
      return 'applied';
    },

    subscribe(types, handler) {
      for (const type of types) {
        if (!registry.has(type))
          throw new Error(`[room] "${type}" is not a registered event type.`);
        let set = handlers.get(type);
        if (!set) handlers.set(type, (set = new Set()));
        set.add(handler);
      }
      const held = types
        .map((type) => latest.get(type))
        .filter((e): e is AnyEnvelope => e !== undefined)
        .sort(compareEnvelopes);
      for (const envelope of held) handler(envelope);
      return () => {
        for (const type of types) handlers.get(type)?.delete(handler);
      };
    },

    latest: (type) => latest.get(type),

    reset() {
      latest.clear();
    },
  };
}

/** The room's dispatcher, backed by the bar's event registry. */
export const dispatcher: Dispatcher = createDispatcher(defaultRegistry as unknown as LooseRegistry);

/** Run `handler` for every envelope of `type` (held state is replayed first). */
export function onRoomEvent<T extends EventType>(
  type: T,
  handler: (envelope: Envelope<T>) => void,
  room: Dispatcher = dispatcher,
): () => void {
  return room.subscribe([type], handler as Handler);
}

export type RoomReducers<S> = {
  [T in EventType]?: (state: S, envelope: Envelope<T>) => S;
};

/**
 * A store whose value is folded from room events. Use it for station-local
 * live state:
 *
 *   export const $nowPlaying = createRoomStore<Track | null>(null, {
 *     'track.changed': (_, e) => e.data,
 *     'track.stopped': () => null,
 *   });
 *
 * State events can arrive out of order (a snapshot racing a live update).
 * When an older state event shows up, the value is recomputed from the
 * latest state envelope of each type, oldest to newest, so latest wins.
 */
export function createRoomStore<S>(
  initial: S,
  reducers: RoomReducers<S>,
  room: Dispatcher = dispatcher,
): ReadableAtom<S> {
  const store = atom<S>(initial);
  const types = Object.keys(reducers);
  const reduce = (state: S, envelope: AnyEnvelope): S => {
    const reducer = reducers[envelope.type as EventType] as
      ((state: S, envelope: AnyEnvelope) => S) | undefined;
    return reducer ? reducer(state, envelope) : state;
  };

  let lastState: AnyEnvelope | undefined;

  room.subscribe(types, (envelope) => {
    const isState = room.latest(envelope.type)?.id === envelope.id;
    if (isState && lastState && compareEnvelopes(envelope, lastState) < 0) {
      const ordered = types
        .map((type) => room.latest(type))
        .filter((e): e is AnyEnvelope => e !== undefined)
        .sort(compareEnvelopes);
      store.set(ordered.reduce(reduce, initial));
      lastState = ordered.at(-1);
      return;
    }
    if (isState) lastState = envelope;
    store.set(reduce(store.get(), envelope));
  });

  return store;
}
