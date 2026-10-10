import { createRegistry, defineEvent, newEventId } from '@bar/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createDispatcher, createRoomStore } from '../src/events.ts';

const lampChanged = defineEvent({
  type: 'lamp.changed',
  domain: 'room',
  kind: 'state',
  description: 'test',
  versions: {
    1: z.object({ on: z.boolean() }),
    2: z.object({ on: z.boolean(), brightness: z.number() }),
  },
  upcast: { 1: (d) => ({ ...d, brightness: d.on ? 1 : 0 }) },
});
const lampOff = defineEvent({
  type: 'lamp.unplugged',
  domain: 'room',
  kind: 'state',
  description: 'test',
  versions: { 1: z.object({}) },
});
const bellRang = defineEvent({
  type: 'bell.rang',
  domain: 'room',
  kind: 'moment',
  description: 'test',
  versions: { 1: z.object({}) },
});
const registry = createRegistry([lampChanged, lampOff, bellRang]);

const envelope = (type: string, data: unknown, at: string, v = 1) => ({
  id: newEventId(),
  type,
  v,
  at,
  source: 'test',
  data,
});

const setup = () => {
  const log = vi.fn();
  return { log, room: createDispatcher(registry as never, log) };
};

describe('dispatcher', () => {
  it('upcasts on receipt so handlers only see the latest shape', () => {
    const { room } = setup();
    const handler = vi.fn();
    room.subscribe(['lamp.changed'], handler);
    room.dispatch(envelope('lamp.changed', { on: true }, '2026-01-01T00:00:00Z'), 'live');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ v: 2, data: { on: true, brightness: 1 } }),
    );
  });

  it('drops invalid envelopes with a log line instead of throwing', () => {
    const { room, log } = setup();
    expect(room.dispatch({ nope: true }, 'live')).toBe('invalid');
    expect(
      room.dispatch(envelope('lamp.changed', { on: 'yes' }, '2026-01-01T00:00:00Z'), 'snapshot'),
    ).toBe('invalid');
    expect(room.dispatch(envelope('ghost.appeared', {}, '2026-01-01T00:00:00Z'), 'live')).toBe(
      'invalid',
    );
    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls[2]?.[0]).toMatch(/not a registered event type/);
  });

  it('keeps the latest state per type and drops stale or duplicate ones', () => {
    const { room } = setup();
    const newer = envelope(
      'lamp.changed',
      { on: true, brightness: 0.5 },
      '2026-01-01T00:00:02Z',
      2,
    );
    const older = envelope('lamp.changed', { on: false }, '2026-01-01T00:00:01Z');
    expect(room.dispatch(newer, 'live')).toBe('applied');
    expect(room.dispatch(older, 'snapshot')).toBe('stale');
    expect(room.dispatch(newer, 'snapshot')).toBe('duplicate');
    expect(room.latest('lamp.changed')?.id).toBe(newer.id);
  });

  it('does not hold moment events', () => {
    const { room } = setup();
    room.dispatch(envelope('bell.rang', {}, '2026-01-01T00:00:00Z'), 'live');
    expect(room.latest('bell.rang')).toBeUndefined();
  });

  it('replays held state to late subscribers, oldest first', () => {
    const { room } = setup();
    room.dispatch(envelope('lamp.unplugged', {}, '2026-01-01T00:00:05Z'), 'snapshot');
    room.dispatch(envelope('lamp.changed', { on: true }, '2026-01-01T00:00:01Z'), 'snapshot');
    const seen: string[] = [];
    room.subscribe(['lamp.unplugged', 'lamp.changed'], (e) => seen.push(e.type));
    expect(seen).toEqual(['lamp.changed', 'lamp.unplugged']);
  });

  it('rejects subscriptions to unregistered types', () => {
    const { room } = setup();
    expect(() => room.subscribe(['ghost.appeared'], vi.fn())).toThrow(
      /not a registered event type/,
    );
  });

  it('isolates a throwing handler', () => {
    const { room } = setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const good = vi.fn();
    room.subscribe(['bell.rang'], () => {
      throw new Error('boom');
    });
    room.subscribe(['bell.rang'], good);
    room.dispatch(envelope('bell.rang', {}, '2026-01-01T00:00:00Z'), 'live');
    expect(good).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('createRoomStore', () => {
  type Lamp = { on: boolean; brightness: number } | 'unplugged' | null;
  const lampStore = (room: ReturnType<typeof setup>['room']) =>
    createRoomStore<Lamp>(
      null,
      {
        ['lamp.changed' as never]: (_: Lamp, e: { data: { on: boolean; brightness: number } }) =>
          e.data,
        ['lamp.unplugged' as never]: () => 'unplugged',
      },
      room,
    );

  it('folds events into state', () => {
    const { room } = setup();
    const $lamp = lampStore(room);
    room.dispatch(envelope('lamp.changed', { on: true }, '2026-01-01T00:00:01Z'), 'live');
    expect($lamp.get()).toEqual({ on: true, brightness: 1 });
    room.dispatch(envelope('lamp.unplugged', {}, '2026-01-01T00:00:02Z'), 'live');
    expect($lamp.get()).toBe('unplugged');
  });

  it('lets the latest state win when events of different types arrive out of order', () => {
    const { room } = setup();
    const $lamp = lampStore(room);
    // Live: switched on at t=5. Then a slow snapshot delivers an unplug from t=1.
    room.dispatch(envelope('lamp.changed', { on: true }, '2026-01-01T00:00:05Z'), 'live');
    room.dispatch(envelope('lamp.unplugged', {}, '2026-01-01T00:00:01Z'), 'snapshot');
    expect($lamp.get()).toEqual({ on: true, brightness: 1 });
  });

  it('starts from held state when created late', () => {
    const { room } = setup();
    room.dispatch(envelope('lamp.changed', { on: false }, '2026-01-01T00:00:01Z'), 'snapshot');
    expect(lampStore(room).get()).toEqual({ on: false, brightness: 0 });
  });
});
