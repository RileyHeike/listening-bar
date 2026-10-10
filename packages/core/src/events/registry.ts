import type { EventDefinition } from './define.ts';
import type { EnvelopeUnion } from './create-registry.ts';
import { createRegistry } from './create-registry.ts';
import { menuUpdated } from './types/menu-updated.ts';
import { spinsUpdated } from './types/spins-updated.ts';
import { trackChanged } from './types/track-changed.ts';
import { trackStopped } from './types/track-stopped.ts';
import { weatherChanged } from './types/weather-changed.ts';
// gen:event-import (`pnpm gen event` inserts imports above this line)

/**
 * Every event type in the bar. Publishing or receiving an unregistered type
 * fails. Add new types with `pnpm gen event`.
 */
export const eventDefinitions = [
  trackChanged,
  trackStopped,
  spinsUpdated,
  weatherChanged,
  menuUpdated,
  // gen:event-entry (`pnpm gen event` inserts entries above this line)
] as const;

export const registry = createRegistry(eventDefinitions);

type Definitions = (typeof eventDefinitions)[number];

export type EventType = Definitions['type'];

export type EventData<T extends EventType> =
  Extract<Definitions, { type: T }> extends EventDefinition<string, infer TData> ? TData : never;

/**
 * A validated, latest-version envelope, discriminated on `type`.
 * `Envelope` alone is the union over every registered type.
 */
export type Envelope<T extends EventType = EventType> = EnvelopeUnion<Definitions, T>;
