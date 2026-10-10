import { z } from 'zod';
import type { EventDefinition } from './define.ts';
import { EventDataError } from './define.ts';
import type { EnvelopeOf } from './envelope.ts';
import { RawEnvelopeSchema, newEventId } from './envelope.ts';

type AnyDefinition = EventDefinition;
type TypeOf<D extends AnyDefinition> = D['type'];
type DataOf<D extends AnyDefinition, T extends string> =
  Extract<D, { type: T }> extends EventDefinition<string, infer TData> ? TData : never;

/** Discriminated union of latest-version envelopes for every event in `D`. */
export type EnvelopeUnion<D extends AnyDefinition, T extends TypeOf<D> = TypeOf<D>> = {
  [K in T]: EnvelopeOf<K, DataOf<D, K>>;
}[T];

export type ReceiveResult<E> =
  { ok: true; envelope: E; upcastFrom: number | null } | { ok: false; error: string };

export class UnknownEventTypeError extends Error {
  override name = 'UnknownEventTypeError';
  constructor(readonly eventType: string) {
    super(`"${eventType}" is not a registered event type. Add it with \`pnpm gen event\`.`);
  }
}

export interface EventRegistry<D extends AnyDefinition> {
  readonly definitions: readonly D[];
  /** Every registered event type. */
  readonly types: readonly TypeOf<D>[];
  /** Every domain (= real-time channel namespace) used by a registered event. */
  readonly domains: readonly string[];
  has(type: string): type is TypeOf<D>;
  get<T extends TypeOf<D>>(type: T): Extract<D, { type: T }>;
  domainOf(type: TypeOf<D>): string;
  /** Domains needed to receive the given event types (deduplicated, sorted). */
  domainsFor(types: Iterable<TypeOf<D>>): string[];
  /** Build and validate a latest-version envelope. Throws on unknown type or invalid data. */
  create<T extends TypeOf<D>>(
    type: T,
    data: DataOf<D, T>,
    options: { source: string; id?: string; at?: Date },
  ): EnvelopeUnion<D, T>;
  /**
   * Validate an envelope from the wire (live or snapshot) and upcast its data
   * to the latest version. Never throws.
   */
  receive(raw: unknown): ReceiveResult<EnvelopeUnion<D>>;
}

export function createRegistry<const D extends AnyDefinition>(
  definitions: readonly D[],
): EventRegistry<D> {
  const byType = new Map<string, D>();
  for (const definition of definitions) {
    if (byType.has(definition.type)) {
      throw new Error(`Event type "${definition.type}" is registered twice.`);
    }
    byType.set(definition.type, definition);
  }

  const lookup = (type: string): D => {
    const definition = byType.get(type);
    if (!definition) throw new UnknownEventTypeError(type);
    return definition;
  };

  const types = definitions.map((d) => d.type as TypeOf<D>);
  const domains = [...new Set(definitions.map((d) => d.domain))].sort();

  return {
    definitions,
    types,
    domains,
    has: (type): type is TypeOf<D> => byType.has(type),
    get: <T extends TypeOf<D>>(type: T) => lookup(type) as Extract<D, { type: T }>,
    domainOf: (type) => lookup(type).domain,
    domainsFor: (wanted) => [...new Set([...wanted].map((type) => lookup(type).domain))].sort(),

    create(type, data, { source, id = newEventId(), at = new Date() }) {
      const definition = lookup(type);
      const envelope: EnvelopeOf<string, unknown> = {
        id,
        type,
        v: definition.latest,
        at: at.toISOString(),
        source,
        data: definition.parseLatest(data),
      };
      return envelope as EnvelopeUnion<D, typeof type>;
    },

    receive(raw) {
      const parsed = RawEnvelopeSchema.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, error: `Malformed envelope:\n${z.prettifyError(parsed.error)}` };
      }
      const envelope = parsed.data;
      const definition = byType.get(envelope.type);
      if (!definition) {
        return { ok: false, error: new UnknownEventTypeError(envelope.type).message };
      }
      try {
        const data = definition.toLatest(envelope.v, envelope.data);
        return {
          ok: true,
          upcastFrom: envelope.v === definition.latest ? null : envelope.v,
          envelope: { ...envelope, v: definition.latest, data } as EnvelopeUnion<D>,
        };
      } catch (error) {
        if (error instanceof EventDataError) return { ok: false, error: error.message };
        throw error;
      }
    },
  };
}
