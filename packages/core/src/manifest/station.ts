import { z } from 'zod';
import type { EventType } from '../events/registry.ts';
import { registry } from '../events/registry.ts';
import { StaticRouteSchema, kebabCase, parseOrThrow, unique } from './common.ts';

export const HYDRATE_STRATEGIES = ['load', 'idle', 'visible', 'none'] as const;
export type HydrateStrategy = (typeof HYDRATE_STRATEGIES)[number];

export const TargetSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/,
    'Targets look like "<page>:<slot>" or "layout:<slot>" (e.g. "room:hifi").',
  );

const eventTypes = registry.types as readonly [EventType, ...EventType[]];

export const StationManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    /** Unique; also used for view-transition names. */
    id: kebabCase('Station id'),
    /** Human name, shown on the record wall and in the nav. */
    name: z.string().min(1).max(40),
    /** One line under the sleeve. */
    blurb: z.string().min(1).max(120).optional(),
    targets: z.array(TargetSchema).refine(unique, 'Targets must be unique.'),
    /** Ascending sort key within a slot, the wall, and the nav. */
    order: z.number().int().optional(),
    /** Set when the station owns a page. */
    route: StaticRouteSchema.optional(),
    /** With `route`: the station appears on the record wall. Path relative to the package. */
    sleeve: z
      .object({
        src: z
          .string()
          .regex(
            /^\.\/[\w./-]+\.(svg|png|webp|avif|jpg)$/,
            'Sleeve src is a package-relative image path, e.g. "./sleeve.svg".',
          ),
      })
      .strict()
      .optional(),
    /** Defaults to true when `route` is set. */
    nav: z.boolean().optional(),
    /** Drafts appear only in local, sandbox and preview builds, with a "being built" page. */
    draft: z.boolean().optional(),
    /** Must match the `client:*` directive in src/index.astro. */
    hydrate: z.enum(HYDRATE_STRATEGIES),
    /** Event types this station reads; drives per-page real-time subscriptions. */
    listens: z
      .array(z.enum(eventTypes))
      .refine(unique, 'Listened types must be unique.')
      .optional(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (manifest.sleeve && !manifest.route) {
      ctx.addIssue({ code: 'custom', path: ['sleeve'], message: 'A sleeve needs a `route`.' });
    }
    if (manifest.sleeve && !manifest.blurb) {
      ctx.addIssue({ code: 'custom', path: ['blurb'], message: 'A sleeve needs a `blurb`.' });
    }
    if (manifest.nav === true && !manifest.route) {
      ctx.addIssue({ code: 'custom', path: ['nav'], message: '`nav: true` needs a `route`.' });
    }
    if (!manifest.draft && manifest.targets.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'A non-draft station needs at least one target.',
      });
    }
  });

export type StationManifest = z.output<typeof StationManifestSchema>;
export type StationManifestInput = z.input<typeof StationManifestSchema>;

export function defineStation(input: StationManifestInput): StationManifest {
  return parseOrThrow(StationManifestSchema, input, `Station "${input.id}"`);
}

/** Whether a station's route appears in the site nav. */
export const inNav = (manifest: StationManifest): boolean =>
  manifest.route !== undefined && manifest.nav !== false;
