# Back end

## API

- Hono app built by `@bar/server`'s `buildApp(modules, runtime)`; each module's routes mounted at `/api/<name>`.
  Platform routes: `GET /api/room/snapshot`, dev-only `POST /api/room/dev/publish` (sandbox and preview only; disabled in production by infra and again in code).
- Runs on Lambda (Node 24, arm64) behind API Gateway HTTP API; CloudFront routes `/api/*` to it so the site and API share one origin.
  Previews call their PR's API cross-origin (CORS allows exactly that preview's origin).
- Lambda grouping from `infra/config/<env>.ts` (start: everything in `api`); infra generates each group's entry, which calls `createApiHandler(modules)`.
- Input validation with Zod on every route (`validate`, `readJson`); errors return `{ error: { code, message } }` with a specific, actionable message.
  Unknown paths return `not_found`; unexpected errors return a generic `internal` message and are logged.

## Data

- DynamoDB, one table per module (`<env prefix>-<name>`), on-demand; DynamoDB Toolbox entities in each module.
- Platform table `room-state` (`<env prefix>-room-state`): PK `type`, holds the latest envelope per state event type.
  Owned by `@bar/server`, provisioned in the Stateful stack.
- Production: PITR on, deletion protection, RemovalPolicy RETAIN.
  Previews and sandboxes: DESTROY.

## Real-time

AppSync Events API with one channel namespace per event domain; events go to channel `/<domain>/room`.
The server publishes over HTTP, SigV4-signed with IAM, from `publish()`.
Browsers connect and subscribe through a Lambda authorizer that admits the public token from `/config.json`; namespaces accept publishes only with IAM, so the public can never publish.
A Lambda authorizer (instead of an API key) means nothing expires.

## Server runtime

`serverRuntime()` builds the config, `room-state` store, AppSync publisher and `publish` from the Lambda environment on first use; API handlers, module routes and jobs share it.
Module code imports `publish` directly from `@bar/server`.
Without cloud environment variables (tests, local runs) it uses in-memory stand-ins.

## Secrets and config

Secrets Manager, names prefixed by environment: `getSecret('api-token')` reads `<SECRETS_PREFIX>/api-token` (e.g. `prod/api-token`) and caches per warm container.
Non-secret config via environment variables set by infra.

## Observability

Powertools for AWS Lambda (TypeScript) structured logger; `withEnvelope(envelope)` adds the event id as the correlation id.
CloudWatch alarms on API 5xx and Lambda errors in production, to an SNS topic (email when `alertEmail` is set in `infra/config/project.ts`).

## Scheduled jobs

Declared in module manifests; infra creates one Lambda per job and an EventBridge Scheduler schedule.
None in the foundation.

## Photos

S3 media bucket in the Stateful stack.
The upload-triggered resizing pipeline is not built yet (nothing uses photos in the foundation).
