import type { ReadableAtom } from 'nanostores';

/**
 * The value a store had when static HTML was rendered. Islands hydrate with
 * it so their first client render matches the server markup exactly.
 * Atoms use their `init`; computed stores register theirs here.
 */
const serverValues = new WeakMap<ReadableAtom<unknown>, unknown>();

export function withServerValue<S extends ReadableAtom<unknown>>(
  store: S,
  value: ReturnType<S['get']>,
): S {
  serverValues.set(store, value);
  return store;
}

export function serverValueOf<T>(store: ReadableAtom<T>): T {
  // Atoms always carry their initial value in `init` (it may legitimately be undefined).
  return serverValues.has(store) ? (serverValues.get(store) as T) : (store.init as T);
}
