import type { SiteContext } from '@bar/core';
import { DEFAULT_PHASE, showsDrafts } from '@bar/core';
import { BAR_ENV, PUBLIC_BAR_TIMEZONE } from 'astro:env/client';
import { navEntries, visibleStations, wallEntries } from './lib/derive.ts';
import { allStations } from './lib/stations.ts';

/** Build-wide site context. The bar's name is an open decision; keep the placeholder. */
export const showDrafts = showsDrafts(BAR_ENV);

export const stations = visibleStations(allStations, showDrafts);

export const site: SiteContext = {
  name: '[BAR NAME]',
  env: BAR_ENV,
  timeZone: PUBLIC_BAR_TIMEZONE,
  defaultPhase: DEFAULT_PHASE,
  nav: navEntries(stations),
  wall: wallEntries(stations),
};
