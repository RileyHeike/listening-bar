import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { Envelope, EventData } from '../src/index.ts';
import {
  EventDataError,
  EventDefinitionError,
  UnknownEventTypeError,
  compareEnvelopes,
  createRegistry,
  defineEvent,
  newEventId,
  registry,
} from '../src/index.ts';

/** A three-version event exercising the full upcast chain. */
const roomRenamed = defineEvent({
  type: 'room.renamed',
  domain: 'room',
  kind: 'state',
  description: 'test',
  versions: {
    1: z.object({ name: z.string() }),
    2: z.object({ name: z.string(), subtitle: z.string().nullable() }),
    3: z.object({ title: z.string(), subtitle: z.string().nullable(), lang: z.string() }),
  },
  upcast: {
    1: (d) => ({ ...d, subtitle: null }),
    2: (d) => ({ title: d.name, subtitle: d.subtitle, lang: 'en' }),
  },
});

const doorbellRang = defineEvent({
  type: 'doorbell.rang',
  domain: 'room',
  kind: 'moment',
  description: 'test',
  versions: { 1: z.object({ times: z.number().int().positive() }) },
});

const testRegistry = createRegistry([roomRenamed, doorbellRang]);

const wire = (overrides: Record<string, unknown>) => ({
  id: newEventId(),
  type: 'room.renamed',
  v: 3,
  at: '2026-01-01T00:00:00.000Z',
  source: 'test',
  data: { title: 'x', subtitle: null, lang: 'en' },
  ...overrides,
});

describe('defineEvent', () => {
  it('rejects type names that are not subject.pastTenseVerb', () => {
    for (const type of ['track', 'Track.changed', 'track.changed.again', 'track-changed']) {
      expect(() =>
        defineEvent({
          type,
          domain: 'music',
          kind: 'state',
          description: '',
          versions: { 1: z.object({}) },
        }),
      ).toThrow(EventDefinitionError);
    }
  });

  it('rejects domains that are not kebab-case', () => {
    expect(() =>
      defineEvent({
        type: 'a.b',
        domain: 'Music',
        kind: 'state',
        description: '',
        versions: { 1: z.object({}) },
      }),
    ).toThrow(/domain/);
  });

  it('rejects non-contiguous versions', () => {
    expect(() =>
      defineEvent({
        type: 'a.b',
        domain: 'a',
        kind: 'state',
        description: '',
        versions: { 1: z.object({}), 3: z.object({}) },
        upcast: { 1: () => ({}) },
      } as never),
    ).toThrow(/contiguous/);
  });

  it('requires an upcaster for every non-latest version', () => {
    expect(() =>
      defineEvent({
        type: 'a.b',
        domain: 'a',
        kind: 'state',
        description: '',
        versions: { 1: z.object({}), 2: z.object({}) },
        upcast: {},
      } as never),
    ).toThrow(/missing an upcaster from v1 to v2/);
  });

  it('rejects an upcaster on the latest version', () => {
    expect(() =>
      defineEvent({
        type: 'a.b',
        domain: 'a',
        kind: 'state',
        description: '',
        versions: { 1: z.object({}) },
        upcast: { 1: () => ({}) },
      } as never),
    ).toThrow(/upcaster for v1/);
  });

  it('allows a window that no longer starts at v1 (older versions retired)', () => {
    const event = defineEvent({
      type: 'a.b',
      domain: 'a',
      kind: 'state',
      description: '',
      versions: { 4: z.object({ a: z.number() }), 5: z.object({ a: z.number(), b: z.number() }) },
      upcast: { 4: (d) => ({ ...d, b: 0 }) },
    });
    expect(event.latest).toBe(5);
    expect(event.toLatest(4, { a: 1 })).toEqual({ a: 1, b: 0 });
    expect(() => event.toLatest(3, { a: 1 })).toThrow(/not supported/);
  });
});

describe('upcasting', () => {
  it('upcasts v1 → v2 → v3', () => {
    expect(roomRenamed.toLatest(1, { name: 'Kissa' })).toEqual({
      title: 'Kissa',
      subtitle: null,
      lang: 'en',
    });
  });

  it('upcasts v2 → v3', () => {
    expect(roomRenamed.toLatest(2, { name: 'Kissa', subtitle: 'jazz' })).toEqual({
      title: 'Kissa',
      subtitle: 'jazz',
      lang: 'en',
    });
  });

  it('validates input at its own version before upcasting', () => {
    expect(() => roomRenamed.toLatest(1, { title: 'wrong shape' })).toThrow(EventDataError);
  });

  it('validates each upcaster output', () => {
    const broken = defineEvent({
      type: 'a.b',
      domain: 'a',
      kind: 'state',
      description: '',
      versions: { 1: z.object({ a: z.number() }), 2: z.object({ a: z.string() }) },
      upcast: { 1: (d) => d as never },
    });
    expect(() => broken.toLatest(1, { a: 1 })).toThrow(/v2/);
  });

  it('types data as the latest version', () => {
    expectTypeOf(roomRenamed.parseLatest).returns.toEqualTypeOf<{
      title: string;
      subtitle: string | null;
      lang: string;
    }>();
  });
});

describe('registry.create', () => {
  it('builds a latest-version envelope', () => {
    const at = new Date('2026-03-01T12:00:00Z');
    const envelope = testRegistry.create('doorbell.rang', { times: 2 }, { source: 'test', at });
    expect(envelope).toMatchObject({
      type: 'doorbell.rang',
      v: 1,
      at: '2026-03-01T12:00:00.000Z',
      source: 'test',
      data: { times: 2 },
    });
    expect(envelope.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('throws on invalid data', () => {
    expect(() => testRegistry.create('doorbell.rang', { times: -1 }, { source: 'test' })).toThrow(
      EventDataError,
    );
  });

  it('throws on unregistered types', () => {
    expect(() => testRegistry.create('nope.happened' as never, {}, { source: 't' })).toThrow(
      UnknownEventTypeError,
    );
  });

  it('rejects duplicate registrations', () => {
    expect(() => createRegistry([doorbellRang, doorbellRang])).toThrow(/twice/);
  });
});

describe('registry.receive', () => {
  it('accepts a latest-version envelope', () => {
    const result = testRegistry.receive(wire({}));
    expect(result.ok && result.upcastFrom).toBeNull();
  });

  it('upcasts an older envelope and reports where it came from', () => {
    const result = testRegistry.receive(wire({ v: 1, data: { name: 'Kissa' } }));
    expect(result).toMatchObject({
      ok: true,
      upcastFrom: 1,
      envelope: { v: 3, data: { title: 'Kissa', subtitle: null, lang: 'en' } },
    });
  });

  it.each([
    ['a non-object', 'hello'],
    ['a bad id', wire({ id: 'not-a-ulid' })],
    ['a bad timestamp', wire({ at: 'yesterday' })],
    ['a missing source', wire({ source: '' })],
    ['a zero version', wire({ v: 0 })],
  ])('rejects %s', (_, raw) => {
    const result = testRegistry.receive(raw);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Malformed envelope/);
  });

  it('rejects unknown types', () => {
    const result = testRegistry.receive(wire({ type: 'ghost.appeared' }));
    expect(!result.ok && result.error).toMatch(/not a registered event type/);
  });

  it('rejects unsupported versions', () => {
    const result = testRegistry.receive(wire({ v: 9 }));
    expect(!result.ok && result.error).toMatch(/not supported/);
  });

  it('rejects invalid data', () => {
    const result = testRegistry.receive(wire({ data: { title: 1 } }));
    expect(!result.ok && result.error).toMatch(/Invalid data for room.renamed v3/);
  });
});

describe('foundation registry', () => {
  it('maps types to domains', () => {
    expect(registry.domainsFor(['track.changed', 'weather.changed'])).toEqual(['music', 'weather']);
    expect(registry.domains).toEqual(expect.arrayContaining(['menu', 'music', 'weather']));
    expect(registry.domains).toEqual([...registry.domains].sort());
  });

  it('exposes discriminated envelope and data types', () => {
    expectTypeOf<EventData<'weather.changed'>['condition']>().toEqualTypeOf<
      'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm'
    >();
    const handle = (envelope: Envelope) => {
      if (envelope.type === 'track.changed') expectTypeOf(envelope.data.title).toBeString();
    };
    expect(handle).toBeTypeOf('function');
  });
});

describe('compareEnvelopes', () => {
  it('orders by time, then by id', () => {
    const a = { at: '2026-01-01T00:00:00.000Z', id: '01A' };
    const b = { at: '2026-01-01T00:00:00.000Z', id: '01B' };
    const c = { at: '2026-01-01T00:00:01.000Z', id: '00Z' };
    expect([c, b, a].sort(compareEnvelopes)).toEqual([a, b, c]);
  });

  it('sorts unparseable times first instead of scrambling the order', () => {
    const bad = { at: '', id: '01Z' };
    const a = { at: '2026-01-01T00:00:00.000Z', id: '01A' };
    const b = { at: '2026-01-01T00:00:01.000Z', id: '01B' };
    expect([b, bad, a].sort(compareEnvelopes)).toEqual([bad, a, b]);
  });
});
