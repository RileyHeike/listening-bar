/**
 * Dev-only hooks for the control panel. Imported only by apps/web's dev
 * tooling, which never ships in staging or production builds.
 */
import type { EventData, EventType, Phase } from '@bar/core';
import { registry } from '@bar/core';
import { api } from './api.ts';
import { dispatcher } from './events.ts';
import { $phaseOverride, $reducedMotionOverride } from './stores.ts';
import { localBus } from './transport/local-bus.ts';

export { $phaseOverride, $reducedMotionOverride };

export const setPhaseOverride = (phase: Phase | null) => {
  $phaseOverride.set(phase);
};

export const setReducedMotionOverride = (reduced: boolean | null) => {
  $reducedMotionOverride.set(reduced);
};

/** Local mode: publish an event through the in-browser bus (this tab and other open tabs). */
export function publishLocal<T extends EventType>(type: T, data: EventData<T>): string {
  const envelope = registry.create(type, data, { source: 'control-panel' });
  localBus().publish(registry.domainOf(type), envelope);
  return envelope.id;
}

/** Sandbox mode: publish through the backend's dev-only route (and so through AppSync). */
export async function publishSandbox<T extends EventType>(
  type: T,
  data: EventData<T>,
): Promise<string> {
  const { id } = await api.request('POST /room/dev/publish', { type, data });
  return id;
}

export const sandboxAvailable = () => api.available;

/** Latest held envelope per state type, for the panel's inspector. */
export const heldState = () =>
  registry.types.flatMap((type) => {
    const envelope = dispatcher.latest(type);
    return envelope ? [envelope] : [];
  });
