import type { ApiRequest, ApiResponse, ApiRoute } from '@bar/core';
import { ApiErrorSchema, apiRoutes } from '@bar/core';

export class ApiClientError extends Error {
  override name = 'ApiClientError';
  constructor(
    readonly route: ApiRoute,
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(`${route} failed (${status} ${code}): ${message}`);
  }
}

export interface ApiClient {
  /** Whether an API is configured (false in fixture-only local dev). */
  readonly available: boolean;
  request<R extends ApiRoute>(
    route: R,
    ...body: ApiRequest<R> extends undefined ? [] : [ApiRequest<R>]
  ): Promise<ApiResponse<R>>;
}

/**
 * Typed client for routes declared in @bar/core's `apiRoutes`. Responses are
 * validated; errors carry the API's `{ error: { code, message } }`.
 */
export function createApiClient(
  base: string | null,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ApiClient {
  return {
    available: base !== null,
    async request(route, ...[body]) {
      if (base === null) {
        throw new ApiClientError(route, 0, 'no_api', 'No API is configured in this environment.');
      }
      const [method = 'GET', path = '/'] = route.split(' ');
      const response = await fetchImpl(`${base.replace(/\/$/, '')}${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? null : JSON.stringify(body),
      });
      const json: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        const error = ApiErrorSchema.safeParse(json);
        throw new ApiClientError(
          route,
          response.status,
          error.success ? error.data.error.code : 'http_error',
          error.success ? error.data.error.message : response.statusText,
        );
      }
      const parsed = apiRoutes[route].response.safeParse(json);
      if (!parsed.success) {
        throw new ApiClientError(route, response.status, 'bad_response', parsed.error.message);
      }
      return parsed.data as ApiResponse<typeof route>;
    },
  };
}

let current: ApiClient = createApiClient(null);

/** The room's API client. Stations read the API only through this. */
export const api: ApiClient = {
  get available() {
    return current.available;
  },
  request: (...args) => current.request(...args),
};

export function configureApi(client: ApiClient): void {
  current = client;
}
