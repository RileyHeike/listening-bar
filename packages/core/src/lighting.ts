/**
 * Lighting follows the owner's local clock: the room's colors drift through
 * six phases across the day (see docs/frontend.md, "Lighting clock").
 */

export const PHASES = ['dawn', 'day', 'golden', 'evening', 'night', 'after-hours'] as const;
export type Phase = (typeof PHASES)[number];

/** Rendered before the clock runs, and when the clock cannot be read. */
export const DEFAULT_PHASE: Phase = 'evening';

export interface PhaseWindow {
  phase: Phase;
  /** Start hour, inclusive (0-23). */
  from: number;
  /** End hour, exclusive (0-23). A window with `to < from` wraps past midnight. */
  to: number;
}

/** Owner-local hours for each phase. Windows tile the full 24 hours. */
export const PHASE_SCHEDULE: readonly PhaseWindow[] = [
  { phase: 'after-hours', from: 2, to: 6 },
  { phase: 'dawn', from: 6, to: 9 },
  { phase: 'day', from: 9, to: 17 },
  { phase: 'golden', from: 17, to: 19 },
  { phase: 'evening', from: 19, to: 22 },
  { phase: 'night', from: 22, to: 2 },
];

/**
 * Opening hours shown on the shop sign, owner-local. Placeholder values for
 * the owner to tune; `closesAt < opensAt` wraps past midnight.
 */
export const BAR_HOURS = { opensAt: 12, closesAt: 2 } as const;

const inWindow = (hour: number, from: number, to: number): boolean =>
  from <= to ? hour >= from && hour < to : hour >= from || hour < to;

function assertHour(hour: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Hour must be an integer from 0 to 23; got ${hour}.`);
  }
}

export function phaseForHour(hour: number): Phase {
  assertHour(hour);
  const match = PHASE_SCHEDULE.find((window) => inWindow(hour, window.from, window.to));
  if (!match) throw new Error(`PHASE_SCHEDULE does not cover hour ${hour}.`);
  return match.phase;
}

export function isOpenAtHour(hour: number): boolean {
  assertHour(hour);
  return inWindow(hour, BAR_HOURS.opensAt, BAR_HOURS.closesAt);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The hour (0-23) on the owner's wall clock at `date`. */
export function ownerHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;
  if (hour === undefined) throw new Error(`Could not read the hour in time zone ${timeZone}.`);
  return Number(hour);
}

export interface Lighting {
  phase: Phase;
  open: boolean;
  hour: number;
}

export function lightingAt(date: Date, timeZone: string): Lighting {
  const hour = ownerHour(date, timeZone);
  return { hour, phase: phaseForHour(hour), open: isOpenAtHour(hour) };
}
