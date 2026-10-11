import { z } from 'zod';

/** Server configuration from environment variables set by infra. */
const ConfigSchema = z.object({
  BAR_ENV: z.enum(['sandbox', 'preview', 'staging', 'production', 'test']).default('test'),
  /** Platform table holding the latest envelope per state event type. */
  ROOM_STATE_TABLE: z.string().min(1).optional(),
  /** AppSync Events HTTP host, e.g. "abc.appsync-api.us-west-2.amazonaws.com". */
  REALTIME_HTTP_HOST: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).default('us-west-2'),
  /** "enabled" turns on dev-only routes. Infra never sets it in production. */
  DEV_ROUTES: z.enum(['enabled', 'disabled']).default('disabled'),
  /** Comma-separated origins allowed by CORS (previews call the API cross-origin). */
  ALLOWED_ORIGINS: z.string().default(''),
});

export type ServerConfig = z.infer<typeof ConfigSchema> & {
  devRoutes: boolean;
  allowedOrigins: string[];
};

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = ConfigSchema.parse(env);
  return {
    ...parsed,
    // Belt and braces: dev routes can never run in production, whatever the flag says.
    devRoutes: parsed.DEV_ROUTES === 'enabled' && parsed.BAR_ENV !== 'production',
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
