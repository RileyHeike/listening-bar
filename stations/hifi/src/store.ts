import type { EventData } from '@bar/core';
import { createRoomStore } from '@bar/room';

export type Track = EventData<'track.changed'>;
export type Spin = EventData<'spins.updated'>['spins'][number];

/** The record on the platter: a track, null between records, undefined until known. */
export const $nowPlaying = createRoomStore<Track | null | undefined>(undefined, {
  'track.changed': (_, envelope) => envelope.data,
  'track.stopped': () => null,
});

/** "Recently spun", most recent first; undefined until known. */
export const $spins = createRoomStore<readonly Spin[] | undefined>(undefined, {
  'spins.updated': (_, envelope) => envelope.data.spins,
});
