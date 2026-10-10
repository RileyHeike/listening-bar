import { $lights, $motion, $phase, $side } from './stores.ts';

/** How long the room takes to drift between phases (matches --dur-light). */
const DRIFT_MS = 6000;

/**
 * Mirror runtime state onto <html> (data-lights, data-side, data-phase,
 * data-motion). data-tone is page-defined and rendered by the server.
 * Re-applied after every client-router swap, because the swap replaces the
 * root element's attributes with the new page's.
 */
export function syncRootAttributes(root: HTMLElement = document.documentElement): () => void {
  let driftTimer: ReturnType<typeof setTimeout> | undefined;

  const apply = () => {
    root.dataset.lights = $lights.get();
    root.dataset.side = $side.get();
    root.dataset.phase = $phase.get();
    root.dataset.motion = $motion.get() ? 'on' : 'off';
  };

  const onPhaseChange = () => {
    // Drift slowly into the new phase, then drop the transition so page
    // swaps and tone changes stay instant.
    if ($motion.get()) {
      root.dataset.drifting = '';
      clearTimeout(driftTimer);
      driftTimer = setTimeout(() => {
        delete root.dataset.drifting;
      }, DRIFT_MS);
    }
    apply();
  };

  apply();
  const unsubscribers = [
    $lights.listen(apply),
    $side.listen(apply),
    $motion.listen(apply),
    $phase.listen(onPhaseChange),
  ];
  document.addEventListener('astro:after-swap', apply);

  return () => {
    clearTimeout(driftTimer);
    for (const unsubscribe of unsubscribers) unsubscribe();
    document.removeEventListener('astro:after-swap', apply);
  };
}
