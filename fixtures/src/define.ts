import type { EventData, EventType } from '@bar/core';

export interface EventFixture<T extends EventType> {
  /** Short label shown in the control panel. */
  label: string;
  data: EventData<T>;
}

export type EventFixtures<T extends EventType> = readonly [EventFixture<T>, ...EventFixture<T>[]];

/** Declare fixtures for one event type. Every registered type needs at least one. */
export const defineFixtures = <T extends EventType>(
  _type: T,
  fixtures: EventFixtures<T>,
): EventFixtures<T> => fixtures;
