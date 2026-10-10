import type { ReadableAtom } from 'nanostores';
import type { LiveStatus } from '../stores.ts';

/**
 * Real-time delivery, per domain (= channel namespace). Feature code never
 * references an implementation directly (docs/contracts/events.md).
 */
export interface Transport {
  /** Receive raw envelopes published in `domain`. Returns an unsubscribe function. */
  subscribe(domain: string, onEnvelope: (envelope: unknown) => void): () => void;
  status: ReadableAtom<LiveStatus>;
}
