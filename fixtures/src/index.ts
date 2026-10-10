import type { Envelope, EventType } from '@bar/core';
import { compareEnvelopes, registry } from '@bar/core';
import type { EventFixtures } from './define.ts';
import menuUpdated from './events/menu-updated.ts';
import spinsUpdated from './events/spins-updated.ts';
import trackChanged from './events/track-changed.ts';
import trackStopped from './events/track-stopped.ts';
import weatherChanged from './events/weather-changed.ts';
// gen:fixture-import (`pnpm gen event` inserts imports above this line)

export type { EventFixture, EventFixtures } from './define.ts';
export { defineFixtures } from './define.ts';
export { stationContext } from './station-context.ts';

/** Fixtures for every registered event type; a missing entry is a compile error. */
export const eventFixtures: { [T in EventType]: EventFixtures<T> } = {
  'track.changed': trackChanged,
  'track.stopped': trackStopped,
  'spins.updated': spinsUpdated,
  'weather.changed': weatherChanged,
  'menu.updated': menuUpdated,
  // gen:fixture-entry (`pnpm gen event` inserts entries above this line)
};

/** Fixed base time so the fixture snapshot is deterministic. */
const SNAPSHOT_TIME = Date.parse('2026-01-01T19:30:00.000Z');

/**
 * What GET /api/room/snapshot would return on a lively evening: the first
 * fixture of every state event, except `track.stopped` (so a record is playing).
 */
export function fixtureSnapshot(): Envelope[] {
  return registry.definitions
    .filter((definition) => definition.kind === 'state' && definition.type !== 'track.stopped')
    .map((definition, index) => {
      const [first] = eventFixtures[definition.type];
      const at = new Date(SNAPSHOT_TIME + index * 1000);
      return registry.create(definition.type, first.data, {
        source: 'fixtures',
        at,
        id: fixtureId(at, index),
      });
    })
    .sort(compareEnvelopes);
}

/** Deterministic ULID: 10 time characters + 16 random characters (here, padded index). */
function fixtureId(at: Date, index: number): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let time = at.getTime();
  let encoded = '';
  for (let i = 0; i < 10; i++) {
    encoded = (alphabet[time % 32] ?? '0') + encoded;
    time = Math.floor(time / 32);
  }
  return encoded + String(index).padStart(16, '0');
}
