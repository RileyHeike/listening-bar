import type { LayoutDefinition, PageDefinition } from './page.ts';
import type { StationManifest } from './station.ts';

export interface DiscoveredStation {
  manifest: StationManifest;
  /** Package folder, for error messages (e.g. "stations/hifi"). */
  location: string;
  /** Source of src/index.astro, or undefined when the file is missing. */
  entrySource: string | undefined;
  /** Whether the file named by `manifest.sleeve.src` exists. */
  sleeveExists: boolean;
}

const CLIENT_DIRECTIVE = /\bclient:([a-zA-Z]+)/g;

/** Hydration directives used in a station entry, deduplicated. */
export function clientDirectives(entrySource: string): string[] {
  return [...new Set([...entrySource.matchAll(CLIENT_DIRECTIVE)].map((match) => match[1] ?? ''))];
}

/**
 * Cross-manifest checks run at build. Returns every problem found, so one
 * build reports them all. An empty array means the station set is valid.
 */
export function validateStationSet(input: {
  stations: readonly DiscoveredStation[];
  pages: readonly PageDefinition[];
  layout: LayoutDefinition;
}): string[] {
  const { stations, pages, layout } = input;
  const errors: string[] = [];

  const slotsByPage = new Map<string, readonly string[]>([
    [layout.id, layout.slots],
    ...pages.map((page) => [page.id, page.slots] as const),
  ]);
  const pageRoutes = new Map(pages.map((page) => [page.route, page]));

  const seenIds = new Map<string, string>();
  const seenRoutes = new Map<string, string>();

  for (const { manifest, location, entrySource, sleeveExists } of stations) {
    const label = `Station "${manifest.id}" (${location})`;

    const previous = seenIds.get(manifest.id);
    if (previous) errors.push(`${label}: id is already used by ${previous}.`);
    seenIds.set(manifest.id, location);

    for (const target of manifest.targets) {
      const [pageId = '', slot = ''] = target.split(':');
      const slots = slotsByPage.get(pageId);
      if (!slots) {
        errors.push(
          `${label}: target "${target}" names page "${pageId}", which is not declared. ` +
            `Declared pages: ${[...slotsByPage.keys()].join(', ')}.`,
        );
      } else if (!slots.includes(slot)) {
        errors.push(
          `${label}: target "${target}" names slot "${slot}", which page "${pageId}" does not ` +
            `declare. Its slots: ${slots.join(', ')}.`,
        );
      }
    }

    if (entrySource === undefined) {
      errors.push(`${label}: src/index.astro is missing.`);
    } else {
      const directives = clientDirectives(entrySource);
      if (directives.includes('only')) {
        errors.push(
          `${label}: client:only is not allowed; stations must render a static shell first.`,
        );
      }
      if (manifest.hydrate === 'none' && directives.length > 0) {
        errors.push(
          `${label}: hydrate is "none" but src/index.astro uses client:${directives.join(', client:')}.`,
        );
      }
      if (manifest.hydrate !== 'none') {
        if (directives.length === 0) {
          errors.push(
            `${label}: hydrate is "${manifest.hydrate}" but src/index.astro has no client:${manifest.hydrate} island.`,
          );
        }
        const mismatched = directives.filter((d) => d !== manifest.hydrate);
        if (mismatched.length > 0) {
          errors.push(
            `${label}: hydrate is "${manifest.hydrate}" but src/index.astro uses client:${mismatched.join(', client:')}.`,
          );
        }
      }
    }

    if (manifest.sleeve && !sleeveExists) {
      errors.push(`${label}: sleeve file ${manifest.sleeve.src} does not exist.`);
    }

    if (manifest.route) {
      const owner = seenRoutes.get(manifest.route);
      if (owner) errors.push(`${label}: route "${manifest.route}" is already owned by ${owner}.`);
      seenRoutes.set(manifest.route, label);

      const page = pageRoutes.get(manifest.route);
      if (manifest.draft) {
        if (page) {
          errors.push(
            `${label}: draft route "${manifest.route}" collides with page "${page.id}"; ` +
              'drafts get an automatic "being built" page.',
          );
        }
      } else if (!page) {
        errors.push(
          `${label}: route "${manifest.route}" has no page. Create one with \`pnpm gen page\`, ` +
            'or mark the station `draft: true`.',
        );
      } else if (!manifest.targets.some((target) => target.startsWith(`${page.id}:`))) {
        errors.push(
          `${label}: owns route "${manifest.route}" but targets no slot on page "${page.id}".`,
        );
      }
    }
  }

  return errors;
}
