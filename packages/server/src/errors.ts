import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** An API error with a stable code and a specific, actionable message. */
export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errorBody = (code: string, message: string) => ({ error: { code, message } });
