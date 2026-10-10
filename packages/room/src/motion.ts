import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { $motion } from './stores.ts';
import { useRoomStore } from './use-store.ts';

/**
 * The motion switch. `false` when the visitor prefers reduced motion or the
 * lights are up. Every decorative animation checks this (CSS: [data-motion]).
 */
export function useMotion(): boolean {
  return useRoomStore($motion);
}

export type TickCallback = (deltaMs: number, timeMs: number) => void;

/** Longest frame delta passed to callbacks, so a resumed tab never jumps. */
const MAX_DELTA_MS = 100;

/**
 * One requestAnimationFrame loop for the whole site. Runs only while it has
 * callbacks and the tab is visible.
 */
export function createTicker(
  raf: (cb: FrameRequestCallback) => number = (cb) => requestAnimationFrame(cb),
  caf: (id: number) => void = (id) => {
    cancelAnimationFrame(id);
  },
) {
  const callbacks = new Set<TickCallback>();
  let frame: number | null = null;
  let last: number | null = null;

  const loop = (time: number) => {
    const delta = last === null ? 0 : Math.min(time - last, MAX_DELTA_MS);
    last = time;
    for (const callback of callbacks) callback(delta, time);
    frame = raf(loop);
  };

  const start = () => {
    if (frame === null && callbacks.size > 0 && !document.hidden) frame = raf(loop);
  };
  const stop = () => {
    if (frame !== null) caf(frame);
    frame = null;
    last = null;
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });
  }

  return {
    add(callback: TickCallback): () => void {
      callbacks.add(callback);
      start();
      return () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) stop();
      };
    },
    get running() {
      return frame !== null;
    },
  };
}

export const ticker = createTicker();

/** Run `callback` every frame while `active`. The latest callback is always used. */
export function useTicker(callback: TickCallback, active: boolean): void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    if (!active) return;
    return ticker.add((delta, time) => {
      ref.current(delta, time);
    });
  }, [active]);
}

/** Whether the element is on screen. Ambient motion pauses when it is not. */
export function useInView<E extends Element>(
  ref: RefObject<E | null>,
  rootMargin = '0px',
): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref, rootMargin]);
  return inView;
}

const ENTRANCE_PREFIX = 'bar:entrance:';

/**
 * Entrance motion plays once per session. Returns true the first time it is
 * called for `name` in this browser session.
 */
export function claimEntrance(name: string): boolean {
  try {
    const key = ENTRANCE_PREFIX + name;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}
