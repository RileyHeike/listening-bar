import { atom } from 'nanostores';
import type { Transport } from './types.ts';

const CHANNEL = 'bar-room-local';

export interface LocalTransport extends Transport {
  /** Deliver an envelope to subscribers of `domain` in this tab and other open tabs. */
  publish(domain: string, envelope: unknown): void;
}

interface Message {
  domain: string;
  envelope: unknown;
}

/**
 * In-browser bus used by the control panel's local mode. Mirrors messages to
 * other tabs with BroadcastChannel so two windows stay in sync offline.
 */
export function createLocalTransport(): LocalTransport {
  const listeners = new Map<string, Set<(envelope: unknown) => void>>();
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  const deliver = ({ domain, envelope }: Message) => {
    for (const listener of listeners.get(domain) ?? []) listener(envelope);
  };
  channel?.addEventListener('message', (event: MessageEvent<Message>) => {
    deliver(event.data);
  });

  return {
    status: atom('open'),
    subscribe(domain, onEnvelope) {
      let set = listeners.get(domain);
      if (!set) listeners.set(domain, (set = new Set()));
      set.add(onEnvelope);
      return () => set.delete(onEnvelope);
    },
    publish(domain, envelope) {
      const message = { domain, envelope };
      deliver(message);
      channel?.postMessage(message);
    },
  };
}
