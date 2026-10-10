import { z } from 'zod';
import type { EventType } from '../events/registry.ts';
import { registry } from '../events/registry.ts';
import { kebabCase, parseOrThrow, unique } from './common.ts';

/** Reserved for platform routes (`/api/room/...`) owned by @bar/server. */
export const PLATFORM_MODULE_NAME = 'room';

const eventTypes = registry.types as readonly [EventType, ...EventType[]];

const KeySchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(['S', 'N']),
  })
  .strict();

const JobSchema = z
  .object({
    name: kebabCase('Job name'),
    schedule: z
      .string()
      .regex(/^(rate|cron)\(.+\)$/, 'Schedules are "rate(...)" or "cron(...)" expressions.'),
    /** Package-relative path to the job file exporting `handler`. */
    handler: z
      .string()
      .regex(/^\.\/src\/jobs\/[\w-]+\.ts$/, 'Handlers live in ./src/jobs/<job>.ts.'),
  })
  .strict();

export const ACCESS_LEVELS = ['public', 'admin'] as const;

export const ModuleManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    /** Mounted at /api/<name>. */
    name: kebabCase('Module name').refine(
      (name) => name !== PLATFORM_MODULE_NAME,
      `"${PLATFORM_MODULE_NAME}" is reserved for platform routes.`,
    ),
    /** Package-relative path to routes.ts. */
    routes: z.literal('./src/routes.ts').optional(),
    /** "METHOD /path" → access level. The admin mechanism is an open decision. */
    access: z
      .record(
        z
          .string()
          .regex(/^(GET|POST|PUT|PATCH|DELETE) \/[\w/:{}-]*$/, 'Keys look like "GET /path".'),
        z.enum(ACCESS_LEVELS),
      )
      .optional(),
    table: z
      .object({
        partitionKey: KeySchema,
        sortKey: KeySchema.optional(),
        indexes: z
          .array(
            z
              .object({
                name: z.string().min(1),
                partitionKey: KeySchema,
                sortKey: KeySchema.optional(),
              })
              .strict(),
          )
          .optional(),
        ttlAttribute: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    emits: z.array(z.enum(eventTypes)).refine(unique, 'Emitted types must be unique.').optional(),
    jobs: z
      .array(JobSchema)
      .refine((jobs) => unique(jobs.map((job) => job.name)), 'Job names must be unique.')
      .optional(),
    /** Secrets Manager names; infra prefixes them with the environment. */
    secrets: z.array(kebabCase('Secret names')).refine(unique).optional(),
    /** Named infra extensions (infra/extensions/<use>.ts). */
    extensions: z
      .array(
        z.object({ use: kebabCase('Extension names'), options: z.unknown().optional() }).strict(),
      )
      .optional(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (manifest.access && !manifest.routes) {
      ctx.addIssue({ code: 'custom', path: ['access'], message: '`access` needs `routes`.' });
    }
  });

export type ModuleManifest = z.output<typeof ModuleManifestSchema>;
export type ModuleManifestInput = z.input<typeof ModuleManifestSchema>;

export function defineModule(input: ModuleManifestInput): ModuleManifest {
  return parseOrThrow(ModuleManifestSchema, input, `Module "${input.name}"`);
}
