import { z } from 'zod';

export const RealtimeConfigSchema = z.object({
  /** AppSync Events HTTP host, e.g. "abc.appsync-api.us-west-2.amazonaws.com". */
  httpHost: z.string().min(1),
  /** AppSync Events real-time host, e.g. "abc.appsync-realtime-api.us-west-2.amazonaws.com". */
  realtimeHost: z.string().min(1),
  /** Public subscribe-only token for the API's Lambda authorizer. */
  authToken: z.string().min(1),
});

/** Endpoints the site talks to. Served as /config.json by every deployed environment. */
export const RuntimeConfigSchema = z.object({
  /** API base URL ("/api" when same-origin), or null when there is no API (local fixtures). */
  apiBase: z.string().min(1).nullable(),
  realtime: RealtimeConfigSchema.nullable(),
});

export type RealtimeConfig = z.infer<typeof RealtimeConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const OFFLINE_CONFIG: RuntimeConfig = { apiBase: null, realtime: null };

/** Fetch and validate /config.json. Falls back to offline (placeholders stay) on failure. */
export async function fetchRuntimeConfig(url = '/config.json'): Promise<RuntimeConfig> {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return RuntimeConfigSchema.parse(await response.json());
  } catch (error) {
    console.warn('[room] Could not load runtime config; staying offline.', error);
    return OFFLINE_CONFIG;
  }
}
