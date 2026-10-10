import { describe, expect, it } from 'vitest';
import { registry } from '@bar/core';
import { eventFixtures, fixtureSnapshot } from '../src/index.ts';

describe('event fixtures', () => {
  it('cover every registered event type', () => {
    expect(Object.keys(eventFixtures).sort()).toEqual([...registry.types].sort());
  });

  it.each(
    registry.types.flatMap((type) => eventFixtures[type].map((f) => [type, f.label, f.data])),
  )('%s "%s" validates against the latest schema', (type, _label, data) => {
    expect(() => registry.create(type as never, data as never, { source: 'test' })).not.toThrow();
  });
});

describe('fixtureSnapshot', () => {
  it('holds only state events, each of which the runtime accepts', () => {
    const snapshot = fixtureSnapshot();
    expect(snapshot.length).toBeGreaterThan(0);
    for (const envelope of snapshot) {
      expect(registry.get(envelope.type).kind).toBe('state');
      expect(registry.receive(envelope).ok).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(fixtureSnapshot()).toEqual(fixtureSnapshot());
  });
});
