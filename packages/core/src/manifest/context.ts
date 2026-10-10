import type { Phase } from '../lighting.ts';

/** Deployment environment a site build targets. */
export const BAR_ENVS = ['local', 'sandbox', 'preview', 'staging', 'production'] as const;
export type BarEnv = (typeof BAR_ENVS)[number];

/** Drafts are visible only where the owner is the audience. */
export const showsDrafts = (env: BarEnv): boolean =>
  env === 'local' || env === 'sandbox' || env === 'preview';

export interface NavEntry {
  id: string;
  name: string;
  route: string;
}

export interface WallEntry {
  id: string;
  name: string;
  blurb: string;
  route: string;
  /** Resolved URL of the sleeve image. */
  sleeveUrl: string;
  draft: boolean;
  /** view-transition-name shared by the sleeve cover and the destination hero. */
  transitionName: string;
}

/** Site-wide data derived from manifests at build time. */
export interface SiteContext {
  /** Placeholder until the bar is named (open decision). */
  name: string;
  env: BarEnv;
  /** Owner's IANA time zone, for the lighting clock and open sign. */
  timeZone: string;
  /** Phase rendered into static HTML before the clock runs. */
  defaultPhase: Phase;
  nav: readonly NavEntry[];
  wall: readonly WallEntry[];
}

/** Props every station entry (src/index.astro) receives from its slot. */
export interface StationContext {
  /** Page id, or "layout" for layout slots. */
  pageId: string;
  /** Current path, e.g. "/workshop/weather-station". */
  path: string;
  /** Route params of the current page, e.g. { slug }. */
  params: Readonly<Record<string, string | undefined>>;
  site: SiteContext;
}

/** view-transition-name for a station's sleeve and its destination hero. */
export const sleeveTransitionName = (stationId: string): string => `sleeve-${stationId}`;
