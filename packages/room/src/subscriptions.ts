import type { Transport } from './transport/types.ts';

/**
 * Keeps transport subscriptions equal to the domains the current page needs,
 * subscribing and unsubscribing only the difference on each navigation.
 */
export function createSubscriptions(
  transports: readonly Transport[],
  onEnvelope: (envelope: unknown) => void,
) {
  const active = new Map<string, (() => void)[]>();

  return {
    update(domains: Iterable<string>) {
      const wanted = new Set(domains);
      for (const [domain, unsubscribers] of active) {
        if (!wanted.has(domain)) {
          for (const unsubscribe of unsubscribers) unsubscribe();
          active.delete(domain);
        }
      }
      for (const domain of wanted) {
        if (!active.has(domain)) {
          active.set(
            domain,
            transports.map((transport) => transport.subscribe(domain, onEnvelope)),
          );
        }
      }
    },
    domains: () => [...active.keys()].sort(),
    clear() {
      this.update([]);
    },
  };
}
