import { newEventId } from '@bar/core';
import { dispatcher } from '@bar/room';
import { describe, expect, it } from 'vitest';
import { $nowPlaying, $spins } from './src/store.ts';

const send = (type: string, data: unknown, at: string) =>
  dispatcher.dispatch({ id: newEventId(), type, v: 1, at, source: 'test', data }, 'live');

describe('hifi stores', () => {
  it('track.changed plays, track.stopped rests, latest wins', () => {
    expect($nowPlaying.get()).toBeUndefined();
    send('track.changed', { source: 'Turntable', title: 'T', artist: 'A' }, '2026-01-01T00:00:01Z');
    expect($nowPlaying.get()).toMatchObject({ title: 'T' });
    send('track.stopped', {}, '2026-01-01T00:00:02Z');
    expect($nowPlaying.get()).toBeNull();
    // A stale play arriving late does not restart the record.
    send(
      'track.changed',
      { source: 'Turntable', title: 'Old', artist: 'A' },
      '2026-01-01T00:00:00Z',
    );
    expect($nowPlaying.get()).toBeNull();
  });

  it('keeps the recently spun list', () => {
    send('spins.updated', { spins: [{ title: 'S', artist: 'A' }] }, '2026-01-01T00:00:03Z');
    expect($spins.get()).toEqual([{ title: 'S', artist: 'A' }]);
  });
});
