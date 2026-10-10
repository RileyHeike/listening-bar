import { compareEnvelopes } from '@bar/core';
import type { ApiClient } from './api.ts';
import type { Dispatcher } from './events.ts';
import { $snapshotStatus } from './stores.ts';

export interface SnapshotSource {
  api: ApiClient;
  /** Used when no API is configured (local dev on fixtures). */
  fixtures?: (() => readonly unknown[] | Promise<readonly unknown[]>) | undefined;
}

const sortKey = (raw: unknown): { at: string; id: string } => {
  const candidate = raw as { at?: unknown; id?: unknown } | null;
  return {
    at: typeof candidate?.at === 'string' ? candidate.at : '',
    id: typeof candidate?.id === 'string' ? candidate.id : '',
  };
};

/**
 * Fetch the latest state of the room and dispatch it, oldest first. Each
 * envelope is validated individually, so one bad item cannot blank the room.
 */
export async function loadSnapshot(source: SnapshotSource, room: Dispatcher): Promise<boolean> {
  $snapshotStatus.set($snapshotStatus.get() === 'ready' ? 'ready' : 'loading');
  try {
    let events: readonly unknown[];
    if (source.api.available) {
      events = (await source.api.request('GET /room/snapshot')).events;
    } else if (source.fixtures) {
      events = await source.fixtures();
    } else {
      $snapshotStatus.set('error');
      return false;
    }
    const ordered = [...events].sort((a, b) => compareEnvelopes(sortKey(a), sortKey(b)));
    for (const raw of ordered) room.dispatch(raw, 'snapshot');
    $snapshotStatus.set('ready');
    return true;
  } catch (error) {
    console.warn('[room] Snapshot failed', error);
    if ($snapshotStatus.get() !== 'ready') $snapshotStatus.set('error');
    return false;
  }
}
