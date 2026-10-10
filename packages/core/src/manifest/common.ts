import { z } from 'zod';

export const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const kebabCase = (what: string) =>
  z.string().regex(KEBAB_CASE, `${what} must be kebab-case (e.g. "record-wall").`);

/** A static route owned by a station, e.g. "/crate". */
export const StaticRouteSchema = z
  .string()
  .regex(
    /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/,
    'Routes start with "/" and use lowercase kebab-case segments (e.g. "/liner-notes").',
  );

/** A page route; may include Astro params, e.g. "/workshop/[slug]". */
export const PageRouteSchema = z
  .string()
  .regex(
    /^\/(([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\])(\/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\]))*)?$/,
    'Page routes start with "/" and use kebab-case segments or [param] segments.',
  );

export class ManifestError extends Error {
  override name = 'ManifestError';
}

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown, label: string) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ManifestError(`${label} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const unique = (items: readonly unknown[]) => new Set(items).size === items.length;
