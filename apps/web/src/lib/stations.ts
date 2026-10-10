import type {
  DiscoveredStation,
  LayoutDefinition,
  PageDefinition,
  StationManifest,
} from '@bar/core';
import { validateStationSet } from '@bar/core';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import layout from '../page-defs/layout.ts';
import type { StationRecord } from './derive.ts';

/*
 * Station discovery (docs/contracts/station.md, "Discovery"): every
 * stations/<id> package is found by glob. Manifests and entries are validated
 * when this module loads, so a bad station fails the build with every problem
 * listed.
 */

const STATIONS = '../../../../stations/';

const manifests = import.meta.glob<StationManifest>('../../../../stations/*/station.ts', {
  eager: true,
  import: 'default',
});
const entries = import.meta.glob<AstroComponentFactory>('../../../../stations/*/src/index.astro', {
  eager: true,
  import: 'default',
});
const entrySources = import.meta.glob<string>('../../../../stations/*/src/index.astro', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const sleeveFiles = import.meta.glob<string>('../../../../stations/*/*.{svg,png,webp,avif,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const pageModules = import.meta.glob<PageDefinition | LayoutDefinition>('../page-defs/*.ts', {
  eager: true,
  import: 'default',
});

export class StationSetError extends Error {
  override name = 'StationSetError';
}

const folderOf = (path: string) => path.slice(STATIONS.length).split('/')[0] ?? '';

export const pages: readonly PageDefinition[] = Object.values(pageModules).filter(
  (definition): definition is PageDefinition => definition.id !== layout.id,
);

function discover(): StationRecord<AstroComponentFactory>[] {
  const records: StationRecord<AstroComponentFactory>[] = [];
  const discovered: DiscoveredStation[] = [];
  const errors: string[] = [];

  for (const [path, manifest] of Object.entries(manifests)) {
    const folder = folderOf(path);
    const location = `stations/${folder}`;
    if (manifest.id !== folder) {
      errors.push(
        `${location}: manifest id "${manifest.id}" must match its folder name "${folder}".`,
      );
    }
    const entryPath = `${STATIONS}${folder}/src/index.astro`;
    const sleevePath = manifest.sleeve
      ? `${STATIONS}${folder}/${manifest.sleeve.src.slice(2)}`
      : '';
    const sleeveUrl = manifest.sleeve ? sleeveFiles[sleevePath] : undefined;
    const Entry = entries[entryPath];

    discovered.push({
      manifest,
      location,
      entrySource: entrySources[entryPath],
      sleeveExists: sleeveUrl !== undefined,
    });
    if (Entry) records.push({ manifest, location, Entry, sleeveUrl });
  }

  errors.push(...validateStationSet({ stations: discovered, pages, layout }));
  if (errors.length > 0) {
    throw new StationSetError(
      `Station manifests are invalid (${errors.length} problem${errors.length === 1 ? '' : 's'}):\n` +
        errors.map((error) => `  • ${error}`).join('\n'),
    );
  }
  return records;
}

/** Every station in the repo, validated. Drafts included; filter with `visibleStations`. */
export const allStations = discover();
