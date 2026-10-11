import type { Envelope, EventData, EventType } from '@bar/core';
import { realtimeChannel, registry } from '@bar/core';
import { logger, withEnvelope } from './logger.ts';
import type { RealtimePublisher } from './realtime.ts';
import type { StateStore } from './room-state.ts';

export type Publish = <T extends EventType>(
  type: T,
  data: EventData<T>,
  options: { source: string },
) => Promise<Envelope<T>>;

/**
 * The only way to publish an event (docs/contracts/module.md). Validates
 * against the registry and wraps the envelope (throws on an unregistered
 * type or invalid data), stores `state` events in room-state, then
 * publishes to the AppSync namespace for the event's domain.
 */
export function createPublisher(deps: { state: StateStore; realtime: RealtimePublisher }): Publish {
  return async (type, data, { source }) => {
    const envelope = registry.create(type, data, { source });
    const definition = registry.get(type);
    const log = withEnvelope(envelope);
    if (definition.kind === 'state') await deps.state.put(envelope);
    await deps.realtime.publish(realtimeChannel(definition.domain), envelope);
    logger.info('Published event', { ...log, domain: definition.domain, source });
    return envelope;
  };
}
