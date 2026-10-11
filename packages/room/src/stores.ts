import type { Phase } from '@bar/core';
import { DEFAULT_PHASE } from '@bar/core';
import type { ReadableAtom, WritableAtom } from 'nanostores';
import { atom, computed } from 'nanostores';
import { withServerValue } from './server-value.ts';
import { readStorage, writeStorage } from './storage.ts';

export type Lights = 'dim' | 'up';
export type Side = 'A' | 'B';
export type LiveStatus = 'connecting' | 'open' | 'offline';
export type SnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';

/** localStorage keys for per-visitor preferences (shared with the boot script). */
export const STORAGE_KEYS = {
  lights: 'bar:lights',
  side: 'bar:side',
  sound: 'bar:sound',
} as const;

function persistent<T extends string | boolean>(
  key: string,
  initial: T,
  parse: (raw: string) => T | undefined,
): WritableAtom<T> {
  const store = atom<T>(initial);
  store.listen((value) => {
    writeStorage(key, String(value));
  });
  /** Load the saved value; called once by the runtime in the browser. */
  restorers.push(() => {
    const raw = readStorage(key);
    const value = raw === null ? undefined : parse(raw);
    if (value !== undefined) store.set(value);
  });
  return store;
}

const restorers: (() => void)[] = [];

/** Apply saved preferences. Safe to call more than once. */
export function restorePreferences(): void {
  for (const restore of restorers) restore();
}

/** Lights: "dim" (the room) or "up" (plain, high contrast, no motion). Persisted. */
export const $lights = persistent<Lights>(STORAGE_KEYS.lights, 'dim', (raw) =>
  raw === 'dim' || raw === 'up' ? raw : undefined,
);

/** Side A / Side B of the counter. Persisted. */
export const $side = persistent<Side>(STORAGE_KEYS.side, 'A', (raw) =>
  raw === 'A' || raw === 'B' ? raw : undefined,
);

/** Sound opt-in. Off until the visitor turns it on. Persisted. */
export const $sound = persistent<boolean>(STORAGE_KEYS.sound, false, (raw) =>
  raw === 'true' ? true : raw === 'false' ? false : undefined,
);

/** Phase from the owner's clock. */
export const $clockPhase = atom<Phase>(DEFAULT_PHASE);

/** Dev-only override (control panel). */
export const $phaseOverride = atom<Phase | null>(null);

/** Current lighting phase. */
export const $phase: ReadableAtom<Phase> = withServerValue(
  computed([$clockPhase, $phaseOverride], (clock, override) => override ?? clock),
  DEFAULT_PHASE,
);

/** Whether the bar is open, by the owner's clock. Null until the clock has run. */
export const $open = atom<boolean | null>(null);

/** `prefers-reduced-motion: reduce`. */
export const $prefersReducedMotion = atom<boolean>(false);

/** Dev-only reduced-motion simulation (control panel). */
export const $reducedMotionOverride = atom<boolean | null>(null);

export const $reducedMotion: ReadableAtom<boolean> = withServerValue(
  computed(
    [$prefersReducedMotion, $reducedMotionOverride],
    (prefers, override) => override ?? prefers,
  ),
  false,
);

/** Decorative motion allowed: not reduced motion, and lights not up. */
export const $motion: ReadableAtom<boolean> = withServerValue(
  computed([$reducedMotion, $lights], (reduced, lights) => !reduced && lights !== 'up'),
  true,
);

/** Real-time connection status. */
export const $live = atom<LiveStatus>('connecting');

/** Whether the snapshot has filled the stores yet. */
export const $snapshotStatus = atom<SnapshotStatus>('idle');

export const setLights = (lights: Lights) => {
  $lights.set(lights);
};
export const toggleLights = () => {
  $lights.set($lights.get() === 'up' ? 'dim' : 'up');
};
export const setSide = (side: Side) => {
  $side.set(side);
};
export const setSound = (on: boolean) => {
  $sound.set(on);
};
