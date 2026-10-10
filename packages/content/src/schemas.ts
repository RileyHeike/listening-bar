import { z } from 'zod';

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use "YYYY-MM" (e.g. "2024-03").');

/** Workshop release statuses, in shelf-filter order. */
export const PROJECT_STATUSES = ['demo', 'studio', 'pressed', 'out'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Shelf filter labels for each status. */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  demo: 'Demo tapes',
  studio: 'In the studio',
  pressed: 'Pressed',
  out: 'Out of print',
};

export const LinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const ProjectFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    status: z.enum(PROJECT_STATUSES),
    year: z.number().int().min(1900).max(2200),
    /** Catalog number shown in mono, e.g. "BAR-003". */
    catalog: z.string().regex(/^[A-Z]+-\d{3}$/, 'Catalog numbers look like "BAR-003".'),
    /** One line for the shelf and the sleeve. */
    summary: z.string().min(1).max(140),
    /** The Workshop page features exactly one project. */
    featured: z.boolean().default(false),
    order: z.number().int().default(0),
    /** Pressing info: small facts shown in mono. */
    pressing: z
      .object({
        format: z.string().min(1),
        stack: z.array(z.string().min(1)).default([]),
        runtime: z.string().min(1).optional(),
      })
      .strict(),
    /** Milestones, shown as a tracklist. */
    tracklist: z
      .array(
        z
          .object({
            title: z.string().min(1),
            date: yearMonth.optional(),
            done: z.boolean().default(false),
          })
          .strict(),
      )
      .min(1),
    credits: z
      .array(z.object({ role: z.string().min(1), name: z.string().min(1) }).strict())
      .default([]),
    links: z.array(LinkSchema.strict()).default([]),
  })
  .strict();

export interface Project extends z.output<typeof ProjectFrontmatterSchema> {
  slug: string;
  /** Rendered long-form write-up (trusted repo content). */
  html: string;
}

export const RoleFrontmatterSchema = z
  .object({
    /** The role, e.g. "[Your role]". */
    title: z.string().min(1),
    org: z.string().min(1),
    start: yearMonth,
    /** Omit for the current role. */
    end: yearMonth.optional(),
    summary: z.string().min(1).max(200),
    standoutTracks: z.array(z.string().min(1)).min(1).max(5),
  })
  .strict()
  .refine((role) => !role.end || role.end >= role.start, {
    message: '`end` must not be before `start`.',
    path: ['end'],
  });

export interface Role extends z.output<typeof RoleFrontmatterSchema> {
  slug: string;
  html: string;
}

export const ProfileSchema = z
  .object({
    name: z.string().min(1),
    role: z.string().min(1),
    summary: z.string().min(1),
    availability: z.string().min(1),
    location: z.string().min(1),
    /** Counter station intro. */
    intro: z.string().min(1),
    meishi: z
      .object({
        title: z.string().min(1),
        lines: z.array(z.string().min(1)).min(1).max(4),
        back: z.string().min(1),
      })
      .strict(),
    skills: z
      .object({
        instruments: z.array(z.string().min(1)).min(1),
        studioGear: z.array(z.string().min(1)).min(1),
        genres: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    links: z.array(LinkSchema.strict()).default([]),
  })
  .strict();

export type Profile = z.output<typeof ProfileSchema>;
