import materials from './materials.json' with { type: 'json' };

/**
 * TS mirror of the motion and scale tokens in tokens.css, for islands that
 * animate with Motion for React. `test/tokens.test.ts` keeps them in sync.
 */

/** Durations in milliseconds (CSS: --dur-*). */
export const duration = {
  quick: 180,
  move: 600,
  light: 6000,
  /** One revolution at 33⅓ RPM (CSS: --rpm-33). */
  rpm33: 1800,
} as const;

/** Cubic-bezier control points (CSS: --ease-*). Usable directly as a Motion `ease`. */
export const easing = {
  settle: [0.2, 0.8, 0.2, 1],
  heavy: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Springs for Motion (JS only; CSS uses the easings above). */
export const spring = {
  /** Things settling into place: sleeves, cards. */
  settle: { type: 'spring', stiffness: 170, damping: 24, mass: 1 },
  /** Heavy objects with inertia: platter, tonearm, noren panels. */
  heavy: { type: 'spring', stiffness: 60, damping: 18, mass: 2.5 },
} as const;

/** Type scale in rem (CSS: --type-*). */
export const typeScale = {
  sm: 0.875,
  base: 1.0625,
  md: 1.25,
  lg: 1.625,
  xl: 2.5,
  '2xl': 3.75,
} as const;

/** Space scale in rem (CSS: --space-1 … --space-6). */
export const space = [0.5, 1, 1.5, 2.5, 4, 6] as const;

/** Layout widths in rem (CSS: --container, --measure). */
export const layout = { container: 80, measure: 34 } as const;

/**
 * Material token names. Stations and @bar/ui must not reference these; the
 * Stylelint plugin enforces it.
 */
export const materialTokens: readonly string[] = materials;

/** Color roles registered with @property so they can transition. */
export const registeredColorRoles = [
  'room-bg',
  'room-surface',
  'room-line',
  'room-ink',
  'room-ink-soft',
  'room-glow',
  'window-sky',
  'signature',
] as const;
