import { useStore } from '@nanostores/react';
import type { Store, StoreValue } from 'nanostores';

/**
 * Read a store in an island. During hydration it returns the store's initial
 * value (matching the server-rendered shell), then the live value.
 */
export function useRoomStore<S extends Store>(store: S): StoreValue<S> {
  return useStore(store, { ssr: 'initial' });
}
