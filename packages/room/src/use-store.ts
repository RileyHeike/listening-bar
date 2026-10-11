import type { ReadableAtom } from 'nanostores';
import { useCallback, useSyncExternalStore } from 'react';
import { serverValueOf } from './server-value.ts';

/**
 * Read a store in an island.
 *
 * Server render and hydration use the store's initial value, so the
 * hydrated markup matches the static shell exactly. Right after hydration
 * React compares that with the live value and re-renders if they differ,
 * which covers data (e.g. the snapshot) that arrived before the island
 * hydrated.
 */
export function useRoomStore<T>(store: ReadableAtom<T>): T {
  const subscribe = useCallback((onChange: () => void) => store.listen(onChange), [store]);
  const getSnapshot = useCallback(() => store.get(), [store]);
  const getServerSnapshot = useCallback(() => serverValueOf(store), [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
