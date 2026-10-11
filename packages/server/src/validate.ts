import type { Context } from 'hono';
import { z } from 'zod';
import { ApiError } from './errors.ts';

/** Parse and validate a JSON request body. Every route validates its input. */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
  return validate(schema, raw);
}

export function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, 'invalid_request', z.prettifyError(result.error));
  }
  return result.data;
}
