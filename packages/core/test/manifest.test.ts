import { describe, expect, it } from 'vitest';
import type { DiscoveredStation, StationManifestInput } from '../src/index.ts';
import {
  ManifestError,
  clientDirectives,
  defineLayout,
  defineModule,
  definePage,
  defineStation,
  inNav,
  validateStationSet,
} from '../src/index.ts';

const base: StationManifestInput = {
  manifestVersion: 1,
  id: 'hifi',
  name: 'Hi-fi',
  targets: ['room:hifi'],
  hydrate: 'visible',
};

describe('defineStation', () => {
  it('accepts a minimal manifest', () => {
    expect(defineStation(base).id).toBe('hifi');
  });

  it.each<[string, Partial<StationManifestInput>, RegExp]>([
    ['a non-kebab id', { id: 'HiFi' }, /kebab-case/],
    ['a bad target', { targets: ['room'] }, /page>:<slot/],
    ['duplicate targets', { targets: ['room:hifi', 'room:hifi'] }, /unique/],
    ['an unknown hydrate strategy', { hydrate: 'eager' as never }, /hydrate/],
    ['an unregistered listened event', { listens: ['ghost.appeared' as never] }, /listens/],
    [
      'a sleeve without a route',
      { sleeve: { src: './sleeve.svg' }, blurb: 'b' },
      /needs a `route`/,
    ],
    ['a sleeve without a blurb', { route: '/hifi', sleeve: { src: './sleeve.svg' } }, /blurb/],
    ['an absolute sleeve path', { route: '/x', blurb: 'b', sleeve: { src: '/sleeve.svg' } }, /src/],
    ['nav without a route', { nav: true }, /`nav: true` needs a `route`/],
    ['a non-draft with no targets', { targets: [] }, /at least one target/],
    ['a bad route', { route: '/Liner_Notes' }, /kebab-case segments/],
    ['an unknown field', { colour: 'red' } as never, /colour/],
    ['a missing manifestVersion', { manifestVersion: undefined }, /manifestVersion/],
  ])('rejects %s', (_, override, message) => {
    expect(() => defineStation({ ...base, ...override })).toThrow(ManifestError);
    expect(() => defineStation({ ...base, ...override })).toThrow(message);
  });

  it('allows drafts without targets', () => {
    const draft = defineStation({
      ...base,
      id: 'crate',
      targets: [],
      draft: true,
      route: '/crate',
    });
    expect(draft.draft).toBe(true);
  });

  it('puts routed stations in the nav unless opted out', () => {
    expect(inNav(defineStation({ ...base, route: '/hifi' }))).toBe(true);
    expect(inNav(defineStation({ ...base, route: '/hifi', nav: false }))).toBe(false);
    expect(inNav(defineStation(base))).toBe(false);
  });
});

describe('definePage / defineLayout', () => {
  it('defaults tone to room', () => {
    expect(definePage({ id: 'room', route: '/', title: 'Room', slots: ['a'] }).tone).toBe('room');
  });

  it('accepts param routes', () => {
    expect(
      definePage({ id: 'project', route: '/workshop/[slug]', title: 'P', slots: ['album'] }).route,
    ).toBe('/workshop/[slug]');
  });

  it.each([
    [{ id: 'layout', route: '/', title: 'x', slots: ['a'] }, /reserved/],
    [{ id: 'room', route: '/', title: 'x', slots: [] }, /slots/],
    [{ id: 'room', route: '/', title: 'x', slots: ['a', 'a'] }, /unique/],
    [{ id: 'room', route: 'room', title: 'x', slots: ['a'] }, /start with "\/"/],
  ])('rejects invalid page %#', (input, message) => {
    expect(() => definePage(input)).toThrow(message);
  });

  it('gives the layout the reserved id', () => {
    expect(defineLayout({ slots: ['header'] }).id).toBe('layout');
  });
});

describe('defineModule', () => {
  const module = { manifestVersion: 1 as const, name: 'plants' };

  it('accepts a full manifest', () => {
    const manifest = defineModule({
      ...module,
      routes: './src/routes.ts',
      access: { 'GET /': 'public', 'POST /readings': 'admin' },
      table: { partitionKey: { name: 'pk', type: 'S' }, ttlAttribute: 'expiresAt' },
      emits: ['weather.changed'],
      jobs: [{ name: 'sync', schedule: 'rate(5 minutes)', handler: './src/jobs/sync.ts' }],
      secrets: ['api-token'],
      extensions: [{ use: 'queue', options: { fifo: true } }],
    });
    expect(manifest.name).toBe('plants');
  });

  it.each([
    [{ name: 'room' }, /reserved/],
    [{ emits: ['ghost.appeared'] }, /emits/],
    [{ jobs: [{ name: 'a', schedule: 'every 5m', handler: './src/jobs/a.ts' }] }, /rate/],
    [{ access: { 'GET /': 'public' } }, /needs `routes`/],
    [{ routes: './routes.ts' }, /routes/],
  ])('rejects invalid module %#', (override, message) => {
    expect(() => defineModule({ ...module, ...override } as never)).toThrow(message);
  });
});

describe('clientDirectives', () => {
  it('finds unique directives', () => {
    expect(
      clientDirectives('<A client:visible /><B client:visible /><C client:idle prop={1} />'),
    ).toEqual(['visible', 'idle']);
  });
});

describe('validateStationSet', () => {
  const layout = defineLayout({ slots: ['header', 'footer'] });
  const pages = [
    definePage({ id: 'room', route: '/', title: 'Room', slots: ['hifi', 'wall'] }),
    definePage({ id: 'workshop', route: '/workshop', title: 'Workshop', slots: ['shelf'] }),
  ];
  const station = (
    manifest: Partial<StationManifestInput>,
    extra: Partial<DiscoveredStation> = {},
  ): DiscoveredStation => ({
    manifest: defineStation({ ...base, ...manifest }),
    location: `stations/${manifest.id ?? base.id}`,
    entrySource: '<Island client:visible />',
    sleeveExists: true,
    ...extra,
  });
  const check = (...stations: DiscoveredStation[]) =>
    validateStationSet({ stations, pages, layout });

  it('accepts a valid set', () => {
    expect(
      check(
        station({}),
        station(
          { id: 'site-header', targets: ['layout:header'], hydrate: 'none' },
          { entrySource: '<header />' },
        ),
        station({
          id: 'shelf',
          targets: ['workshop:shelf'],
          route: '/workshop',
          blurb: 'b',
          sleeve: { src: './sleeve.svg' },
        }),
        station({ id: 'crate', targets: [], route: '/crate', draft: true }),
      ),
    ).toEqual([]);
  });

  it('reports duplicate ids', () => {
    expect(check(station({}), station({}))).toEqual([
      expect.stringMatching(/id is already used by stations\/hifi/),
    ]);
  });

  it('reports undeclared pages and slots', () => {
    expect(check(station({ targets: ['bar:hifi', 'room:stage'] }))).toEqual([
      expect.stringMatching(/names page "bar", which is not declared/),
      expect.stringMatching(/names slot "stage", which page "room" does not declare/),
    ]);
  });

  it('reports hydrate mismatches', () => {
    expect(check(station({}, { entrySource: '<A client:load />' }))).toEqual([
      expect.stringMatching(/hydrate is "visible" but src\/index.astro uses client:load/),
    ]);
    expect(check(station({}, { entrySource: '<A />' }))).toEqual([
      expect.stringMatching(/has no client:visible island/),
    ]);
    expect(check(station({ hydrate: 'none' }))).toEqual([
      expect.stringMatching(/hydrate is "none" but/),
    ]);
  });

  it('forbids client:only', () => {
    expect(
      check(station({}, { entrySource: '<A client:visible /><B client:only="react" />' })),
    ).toEqual([
      expect.stringMatching(/client:only is not allowed/),
      expect.stringMatching(/uses client:only/),
    ]);
  });

  it('reports a missing entry or sleeve', () => {
    expect(check(station({}, { entrySource: undefined }))).toEqual([
      expect.stringMatching(/src\/index.astro is missing/),
    ]);
    expect(
      check(
        station(
          {
            targets: ['workshop:shelf'],
            route: '/workshop',
            blurb: 'b',
            sleeve: { src: './s.svg' },
          },
          { sleeveExists: false },
        ),
      ),
    ).toEqual([expect.stringMatching(/sleeve file .\/s.svg does not exist/)]);
  });

  it('checks routes against pages', () => {
    expect(check(station({ route: '/nowhere' }))).toEqual([
      expect.stringMatching(/route "\/nowhere" has no page/),
    ]);
    expect(check(station({ route: '/workshop' }))).toEqual([
      expect.stringMatching(/targets no slot on page "workshop"/),
    ]);
    expect(check(station({ id: 'crate', targets: [], route: '/workshop', draft: true }))).toEqual([
      expect.stringMatching(/collides with page "workshop"/),
    ]);
    expect(
      check(
        station({ id: 'a', targets: [], route: '/crate', draft: true }),
        station({ id: 'b', targets: [], route: '/crate', draft: true }),
      ),
    ).toEqual([expect.stringMatching(/already owned by/)]);
  });
});
