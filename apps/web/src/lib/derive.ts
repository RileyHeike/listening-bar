import type { EventType, NavEntry, StationManifest, WallEntry } from '@bar/core';
import { LAYOUT_ID, inNav, registry, sleeveTransitionName } from '@bar/core';

/** A discovered station: its manifest plus what the site resolved for it. */
export interface StationRecord<Entry = unknown> {
  manifest: StationManifest;
  /** Package folder, e.g. "stations/hifi". */
  location: string;
  Entry: Entry;
  sleeveUrl: string | undefined;
}

const byOrder = (a: StationRecord, b: StationRecord) =>
  (a.manifest.order ?? 0) - (b.manifest.order ?? 0) || a.manifest.id.localeCompare(b.manifest.id);

/** Drop drafts unless this build shows them. */
export const visibleStations = <E>(records: readonly StationRecord<E>[], showDrafts: boolean) =>
  records.filter((record) => showDrafts || !record.manifest.draft);

/** Stations rendered into `target` ("page:slot"), in order. */
export const stationsForTarget = <E>(records: readonly StationRecord<E>[], target: string) =>
  records.filter((record) => record.manifest.targets.includes(target)).sort(byOrder);

export const navEntries = (records: readonly StationRecord[]): NavEntry[] =>
  records
    .filter((record) => inNav(record.manifest))
    .sort(byOrder)
    .map(({ manifest }) => ({
      id: manifest.id,
      name: manifest.name,
      route: manifest.route ?? '/',
    }));

/** Sleeves on the record wall: every station with a route and a sleeve. */
export const wallEntries = (records: readonly StationRecord[]): WallEntry[] =>
  records
    .filter((record) => record.manifest.route && record.manifest.sleeve && record.sleeveUrl)
    .sort(byOrder)
    .map(({ manifest, sleeveUrl }) => ({
      id: manifest.id,
      name: manifest.name,
      blurb: manifest.blurb ?? '',
      route: manifest.route ?? '/',
      sleeveUrl: sleeveUrl ?? '',
      draft: manifest.draft ?? false,
      transitionName: sleeveTransitionName(manifest.id),
    }));

/** Draft stations that own a route get an automatic "being built" page. */
export const draftPages = <E>(records: readonly StationRecord<E>[]) =>
  records.filter((record) => record.manifest.draft && record.manifest.route);

/** Real-time domains needed by the stations on a page (plus the layout's). */
export function domainsForPage(records: readonly StationRecord[], pageId: string): string[] {
  const types = new Set<EventType>();
  for (const { manifest } of records) {
    const onPage = manifest.targets.some(
      (target) => target.startsWith(`${pageId}:`) || target.startsWith(`${LAYOUT_ID}:`),
    );
    if (onPage) for (const type of manifest.listens ?? []) types.add(type);
  }
  return registry.domainsFor(types);
}
