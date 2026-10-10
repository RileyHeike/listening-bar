/**
 * Motion vocabulary shared by the runtime and stations. Durations and easings
 * live in @bar/tokens; this file holds the semantics.
 *
 * - entrance: plays once per session (e.g. the noren settling).
 * - responsive: answers a visitor action (sleeve pull, side flip, lights up).
 * - ambient: data-driven loops (platter, VU needles, rain); must pause when
 *   off-screen, when the tab is hidden, and on station leave.
 */
export const MOTION_CATEGORIES = ['entrance', 'responsive', 'ambient'] as const;
export type MotionCategory = (typeof MOTION_CATEGORIES)[number];

/** A record at 33⅓ RPM turns once every 1.8 seconds. */
export const RPM_33 = 100 / 3;
export const SECONDS_PER_REVOLUTION_33 = 60 / RPM_33;
