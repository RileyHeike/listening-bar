# Back end

## API

- Hono app built by `@bar/server`'s `buildApp(modules)`; each module's routes
  mounted at `/api/<name>`. Platform routes: `GET /api/room/snapshot`,
  dev-only `POST /api/room/dev/publish` (sandbox/preview only; never prod).
- Runs on Lambda behind API Gateway HTTP API; CloudFront routes `/api/*` to it
  so the site and API share one origin.
- Lambda grouping from `infra/config/<env>.ts` (start: everything in `api`).
- Input validation with Zod on every route; errors return
  `{ error: { code, message } }` with a specific, actionable message.

## Data

- DynamoDB, one table per module, on-demand; DynamoDB Toolbox entities in
  each module.
- Platform table `room-state`: PK `type`, holds the latest envelope per state
  event type. Owned by `@bar/server`, provisioned in the Stateful stack.
- Production: PITR on, RemovalPolicy RETAIN. Previews/sandbox: DESTROY.

## Real-time

AppSync Events API with one channel namespace per event domain. Server
publishes over HTTP (IAM-signed) from `publish()`. Browser subscribes with the
API's public read authorization (exact auth mode to configure per AWS docs:
subscribe-only for the public; publish restricted to the backend).

## Secrets and config

Secrets Manager, names prefixed by environment; `getSecret(name)` caches per
warm container. Non-secret config via environment variables set by infra.

## Observability

Powertools for AWS Lambda (TypeScript): structured logger (includes envelope
id as correlation id), metrics, tracing. CloudWatch alarms on API 5xx and
Lambda errors for production.

## Scheduled jobs

Declared in module manifests; infra creates one Lambda per job and an
EventBridge Scheduler schedule. None in the foundation.

## Photos

S3 media bucket (Stateful); an upload-triggered Lambda creates sized
AVIF/WebP variants; served via CloudFront. Pipeline scaffolded but unused in
the foundation unless trivial.
