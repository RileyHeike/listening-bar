import { z } from 'zod';
import type { EventType } from './events/registry.ts';
import { registry } from './events/registry.ts';

/** Every API error body: a stable code plus a specific, actionable message. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Latest envelope for each state event. Envelopes stay `unknown` here: the
 * client validates and upcasts each one individually, so one bad item never
 * blanks the whole room.
 */
export const SnapshotSchema = z.object({
  events: z.array(z.unknown()),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

const eventTypes = registry.types as readonly [EventType, ...EventType[]];

/** Body of the dev-only publish route (sandbox and previews; never production). */
export const DevPublishRequestSchema = z.object({
  type: z.enum(eventTypes),
  data: z.unknown(),
});
export type DevPublishRequest = z.infer<typeof DevPublishRequestSchema>;

export const DevPublishResponseSchema = z.object({ id: z.string() });

/**
 * Typed API surface, relative to the API base (`/api`). The browser client
 * in @bar/room only calls routes listed here.
 */
export const apiRoutes = {
  'GET /room/snapshot': { request: z.undefined(), response: SnapshotSchema },
  'POST /room/dev/publish': {
    request: DevPublishRequestSchema,
    response: DevPublishResponseSchema,
  },
} as const;

export type ApiRoute = keyof typeof apiRoutes;
export type ApiRequest<R extends ApiRoute> = z.input<(typeof apiRoutes)[R]['request']>;
export type ApiResponse<R extends ApiRoute> = z.output<(typeof apiRoutes)[R]['response']>;
