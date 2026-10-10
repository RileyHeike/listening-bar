import type { StationManifestInput } from '@bar/core';
import { defineStation } from '@bar/core';
import { describe, expect, it } from 'vitest';
import type { StationRecord } from '../src/lib/derive.ts';
import {
  domainsForPage,
  draftPages,
  navEntries,
  stationsForTarget,
  visibleStations,
  wallEntries,
} from '../src/lib/derive.ts';

const record = (
  input: Partial<StationManifestInput> & { id: string },
  sleeveUrl?: string,
): StationRecord => ({
  manifest: defineStation({
    manifestVersion: 1,
    name: input.id,
    targets: [],
    hydrate: 'none',
    draft: true,
    ...input,
  }),
  location: `stations/${input.id}`,
  Entry: null,
  sleeveUrl,
});

const workshop = record(
  {
    id: 'workshop-featured',
    name: 'Workshop',
    blurb: 'Things on the bench',
    targets: ['workshop:featured'],
    route: '/workshop',
    sleeve: { src: './sleeve.svg' },
    order: 1,
    draft: false,
    listens: ['menu.updated'],
  },
  '/w.svg',
);
const liner = record({
  id: 'liner-intro',
  name: 'Liner Notes',
  targets: ['liner-notes:intro'],
  route: '/liner-notes',
  order: 2,
  draft: false,
});
const crate = record(
  {
    id: 'crate',
    name: 'Crate',
    blurb: 'Digging',
    route: '/crate',
    sleeve: { src: './sleeve.svg' },
    order: 3,
  },
  '/c.svg',
);
const hifi = record({
  id: 'hifi',
  targets: ['room:hifi'],
  draft: false,
  listens: ['track.changed', 'spins.updated'],
});
const header = record({
  id: 'site-header',
  targets: ['layout:header'],
  draft: false,
  listens: ['weather.changed'],
});
const all = [crate, liner, workshop, hifi, header];

describe('derived UI', () => {
  it('hides drafts unless the build shows them', () => {
    expect(visibleStations(all, false).map((r) => r.manifest.id)).not.toContain('crate');
    expect(visibleStations(all, true)).toHaveLength(all.length);
  });

  it('fills slots in order', () => {
    const a = record({ id: 'a', targets: ['room:wall'], order: 2, draft: false });
    const b = record({ id: 'b', targets: ['room:wall'], order: 1, draft: false });
    expect(stationsForTarget([a, b, hifi], 'room:wall').map((r) => r.manifest.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('builds the nav from routed stations', () => {
    expect(navEntries(all).map((n) => n.name)).toEqual(['Workshop', 'Liner Notes', 'Crate']);
  });

  it('puts every routed station with a sleeve on the wall', () => {
    expect(wallEntries(all)).toEqual([
      expect.objectContaining({ id: 'workshop-featured', sleeveUrl: '/w.svg', draft: false }),
      expect.objectContaining({ id: 'crate', draft: true, transitionName: 'sleeve-crate' }),
    ]);
  });

  it('gives routed drafts a stub page', () => {
    expect(draftPages(all).map((r) => r.manifest.route)).toEqual(['/crate']);
  });

  it('subscribes each page to its stations’ domains plus the layout’s', () => {
    expect(domainsForPage(all, 'room')).toEqual(['music', 'weather']);
    expect(domainsForPage(all, 'workshop')).toEqual(['menu', 'weather']);
  });
});
