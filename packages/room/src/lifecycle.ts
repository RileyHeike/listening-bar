import { useEffect, useRef } from 'react';

export interface StationLifecycle {
  /** The station is on the page and hydrated: start ambient work. */
  onEnter?: () => void;
  /** The visitor is leaving the page (or the island unmounts): stop it. */
  onLeave?: () => void;
}

/**
 * Start and stop ambient work across client-router navigations. `onLeave`
 * fires once, at the earliest of: the router starting to swap pages, or
 * the island unmounting.
 */
export function useStationLifecycle({ onEnter, onLeave }: StationLifecycle): void {
  const handlers = useRef({ onEnter, onLeave });
  useEffect(() => {
    handlers.current = { onEnter, onLeave };
  });

  useEffect(() => {
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      handlers.current.onLeave?.();
    };
    handlers.current.onEnter?.();
    document.addEventListener('astro:before-swap', leave);
    return () => {
      document.removeEventListener('astro:before-swap', leave);
      leave();
    };
  }, []);
}
