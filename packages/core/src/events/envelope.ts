import { ulid } from 'ulid';
import { z } from 'zod';

/** Wire shape of every event, before its `data` is validated against the registry. */
export const RawEnvelopeSchema = z.object({
  id: z.ulid(),
  type: z.string().min(1),
  v: z.number().int().positive(),
  at: z.iso.datetime(),
  source: z.string().min(1),
  data: z.unknown(),
});

export type RawEnvelope = z.infer<typeof RawEnvelopeSchema>;

export interface EnvelopeOf<TType extends string, TData> {
  /** ULID; sorts by creation time. */
  id: string;
  type: TType;
  /** Schema version of `data`. */
  v: number;
  /** ISO-8601 UTC timestamp. */
  at: string;
  /** Module name, or "control-panel". */
  source: string;
  data: TData;
}

export const newEventId = (): string => ulid();

const timeOf = (at: string): number => {
  const time = Date.parse(at);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

/**
 * Order envelopes oldest-first. ULIDs sort by creation time, so `id` breaks
 * ties between envelopes created in the same millisecond. Unparseable times
 * sort first (they are dropped by validation anyway).
 */
export function compareEnvelopes(a: { at: string; id: string }, b: { at: string; id: string }) {
  const ta = timeOf(a.at);
  const tb = timeOf(b.at);
  const byTime = ta === tb ? 0 : ta < tb ? -1 : 1;
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
