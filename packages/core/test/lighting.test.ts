import { describe, expect, it } from 'vitest';
import {
  PHASE_SCHEDULE,
  isOpenAtHour,
  isValidTimeZone,
  lightingAt,
  ownerHour,
  phaseForHour,
} from '../src/index.ts';

describe('phaseForHour', () => {
  it.each([
    [2, 'after-hours'],
    [5, 'after-hours'],
    [6, 'dawn'],
    [8, 'dawn'],
    [9, 'day'],
    [16, 'day'],
    [17, 'golden'],
    [18, 'golden'],
    [19, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [23, 'night'],
    [0, 'night'],
    [1, 'night'],
  ])('hour %i is %s', (hour, phase) => {
    expect(phaseForHour(hour)).toBe(phase);
  });

  it('wraps night across midnight', () => {
    expect([22, 23, 0, 1].map(phaseForHour)).toEqual(['night', 'night', 'night', 'night']);
    expect(phaseForHour(2)).toBe('after-hours');
  });

  it('tiles all 24 hours exactly once', () => {
    for (let hour = 0; hour < 24; hour++) {
      const matches = PHASE_SCHEDULE.filter(({ from, to }) =>
        from <= to ? hour >= from && hour < to : hour >= from || hour < to,
      );
      expect(matches, `hour ${hour}`).toHaveLength(1);
    }
  });

  it.each([-1, 24, 1.5, Number.NaN])('rejects %s', (hour) => {
    expect(() => phaseForHour(hour)).toThrow(RangeError);
  });
});

describe('opening hours', () => {
  it('is open from noon until 2am, wrapping midnight', () => {
    expect(isOpenAtHour(11)).toBe(false);
    expect(isOpenAtHour(12)).toBe(true);
    expect(isOpenAtHour(23)).toBe(true);
    expect(isOpenAtHour(0)).toBe(true);
    expect(isOpenAtHour(1)).toBe(true);
    expect(isOpenAtHour(2)).toBe(false);
  });
});

describe('owner clock', () => {
  it('reads the hour in the owner time zone', () => {
    const date = new Date('2026-01-15T08:30:00Z');
    expect(ownerHour(date, 'UTC')).toBe(8);
    expect(ownerHour(date, 'America/Los_Angeles')).toBe(0);
    expect(ownerHour(date, 'Asia/Tokyo')).toBe(17);
  });

  it('follows daylight saving time', () => {
    expect(ownerHour(new Date('2026-07-15T08:30:00Z'), 'America/Los_Angeles')).toBe(1);
  });

  it('derives phase and open state together', () => {
    expect(lightingAt(new Date('2026-01-15T06:15:00Z'), 'America/Los_Angeles')).toEqual({
      hour: 22,
      phase: 'night',
      open: true,
    });
  });

  it('validates time zones', () => {
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});
