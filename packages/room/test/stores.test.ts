import { PHASES, phaseForHour } from '@bar/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncRootAttributes } from '../src/attributes.ts';
import { bootScript } from '../src/boot.ts';
import { startClock } from '../src/clock.ts';
import {
  $clockPhase,
  $lights,
  $motion,
  $open,
  $phase,
  $phaseOverride,
  $prefersReducedMotion,
  $side,
  STORAGE_KEYS,
  restorePreferences,
} from '../src/stores.ts';

beforeEach(() => {
  localStorage.clear();
  $lights.set('dim');
  $side.set('A');
  $prefersReducedMotion.set(false);
  $phaseOverride.set(null);
});

describe('preferences', () => {
  it('persists lights, side and sound', () => {
    $lights.set('up');
    $side.set('B');
    expect(localStorage.getItem(STORAGE_KEYS.lights)).toBe('up');
    expect(localStorage.getItem(STORAGE_KEYS.side)).toBe('B');
  });

  it('restores saved values and ignores garbage', () => {
    localStorage.setItem(STORAGE_KEYS.lights, 'up');
    localStorage.setItem(STORAGE_KEYS.side, 'Z');
    restorePreferences();
    expect($lights.get()).toBe('up');
    expect($side.get()).toBe('A');
  });
});

describe('motion switch', () => {
  it('is off with reduced motion or lights up', () => {
    expect($motion.get()).toBe(true);
    $prefersReducedMotion.set(true);
    expect($motion.get()).toBe(false);
    $prefersReducedMotion.set(false);
    $lights.set('up');
    expect($motion.get()).toBe(false);
  });
});

describe('phase', () => {
  it('prefers the dev override', () => {
    $clockPhase.set('day');
    $phaseOverride.set('night');
    expect($phase.get()).toBe('night');
    $phaseOverride.set(null);
    expect($phase.get()).toBe('day');
  });
});

describe('lighting clock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets phase and open state, then updates at the top of each minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T16:59:30Z'));
    const stop = startClock('UTC');
    expect($clockPhase.get()).toBe('day');
    expect($open.get()).toBe(true);
    vi.advanceTimersByTime(31_000);
    expect($clockPhase.get()).toBe('golden');
    stop();
  });

  it('stays off with an invalid time zone', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    startClock('Nowhere/Land')();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/Invalid PUBLIC_BAR_TIMEZONE/));
    error.mockRestore();
  });
});

describe('root attributes', () => {
  it('mirrors state onto <html> and re-applies after a client-router swap', () => {
    const root = document.documentElement;
    const stop = syncRootAttributes(root);
    expect(root.dataset).toMatchObject({ lights: 'dim', side: 'A', motion: 'on' });
    $lights.set('up');
    expect(root.dataset).toMatchObject({ lights: 'up', motion: 'off' });
    // A swap replaces root attributes with the new page's server-rendered ones.
    root.dataset.lights = 'dim';
    document.dispatchEvent(new Event('astro:after-swap'));
    expect(root.dataset.lights).toBe('up');
    stop();
  });
});

describe('boot script', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const run = (script: string) => {
    for (const name of ['lights', 'side', 'phase', 'motion']) {
      document.documentElement.removeAttribute(`data-${name}`);
    }
    // Evaluate the generated inline script exactly as the browser would.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const execute = new Function(script) as () => void;
    execute();
    return Object.fromEntries(Object.entries(document.documentElement.dataset));
  };

  it('matches the runtime phase for every hour', () => {
    vi.useFakeTimers();
    for (let hour = 0; hour < 24; hour++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, hour, 30)));
      expect(run(bootScript({ timeZone: 'UTC' })).phase, `hour ${hour}`).toBe(phaseForHour(hour));
    }
  });

  it('applies saved preferences before paint', () => {
    localStorage.setItem(STORAGE_KEYS.lights, 'up');
    localStorage.setItem(STORAGE_KEYS.side, 'B');
    expect(run(bootScript({ timeZone: 'UTC' }))).toMatchObject({
      lights: 'up',
      side: 'B',
      motion: 'off',
    });
  });

  it('falls back to the default phase for a bad time zone', () => {
    expect(PHASES).toContain(
      run(bootScript({ timeZone: 'Nowhere/Land', defaultPhase: 'evening' })).phase,
    );
    expect(run(bootScript({ timeZone: 'Nowhere/Land', defaultPhase: 'evening' })).phase).toBe(
      'evening',
    );
  });

  it('cannot break out of its <script> tag', () => {
    expect(bootScript({ timeZone: '</script><script>alert(1)</script>' })).not.toContain(
      '</script>',
    );
  });
});
