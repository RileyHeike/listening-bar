import { isValidTimeZone, lightingAt } from '@bar/core';
import { $clockPhase, $open } from './stores.ts';

/**
 * Lighting clock: computes phase and open state in the owner's time zone,
 * immediately and then at the top of every minute.
 */
export function startClock(timeZone: string, now: () => Date = () => new Date()): () => void {
  if (!isValidTimeZone(timeZone)) {
    console.error(`[room] Invalid PUBLIC_BAR_TIMEZONE "${timeZone}"; the lighting clock is off.`);
    return () => undefined;
  }

  const tick = () => {
    const lighting = lightingAt(now(), timeZone);
    $clockPhase.set(lighting.phase);
    $open.set(lighting.open);
  };

  tick();
  let interval: ReturnType<typeof setInterval> | undefined;
  const msToNextMinute = 60_000 - (now().getTime() % 60_000);
  const timeout = setTimeout(() => {
    tick();
    interval = setInterval(tick, 60_000);
  }, msToNextMinute);

  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}
