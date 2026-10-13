# Decision log

Status key: **Settled** (implement as written) · **Default** (adopted; owner may
veto) · **Open** (must ask the owner before implementing) · **Parked** (out of
scope for the foundation; do not build).

## Product

| Topic | Decision | Status |
|---|---|---|
| Concept | Japanese jazz-kissa listening bar, mid-century modern; one "room" of stations | Settled |
| Foundation scope | Structure + aesthetic theme + placeholder stations on fixtures for Room, Workshop, Liner Notes | Settled |
| Back-end modules in foundation | None; platform pieces only (snapshot, publishing, real-time) | Settled |
| Bar name and domain | Name pending; domain registered via Route 53 once named | Open |

## Front end

| Topic | Decision | Status |
|---|---|---|
| Framework | Astro, static output | Settled |
| Islands | React only (one framework for all stations) | Settled |
| Stations | One workspace package per station under `stations/` | Settled |
| Discovery | Glob across workspace folders (`stations/*`) | Settled |
| Slots | Page-defined; layouts may declare slots too | Settled |
| Station rules | Static shell first, per-station hydration, error boundary, no cross-imports, data via room stores, enter/leave lifecycle | Settled |
| Derived UI | Record wall, nav, draft pages generated from manifests | Settled |
| Live content in static pages | Placeholder in shell, filled by snapshot after load | Settled |
| Page transitions | Astro client router; runtime + audio persist across navigation | Settled |
| Animation library | Motion for React, lazily loaded (`LazyMotion`) | Settled |
| Motion system | One switch; tokens shared CSS/JS; entrance/responsive/ambient categories; transform/opacity only; shared ticker | Settled |
| Sound | Audio manager in the room runtime (Web Audio), opt-in | Settled |
| Control panel | Dev-only; local and sandbox modes with a toggle | Settled |
| Client runtime package | `@bar/room` (stores, transport, snapshot, motion, audio, lifecycle) | Default |
| Shared UI primitives | `@bar/ui` package for components used by several stations | Default |
| Token lint | Stylelint rule: no raw hex/material tokens in station CSS | Default |

## Contracts

| Topic | Decision | Status |
|---|---|---|
| Schemas | Zod, in `@bar/core`; validated on publish and receipt | Settled |
| Event envelope | id, type, v, at, source, data; kinds: state / moment | Settled |
| Event naming | `domain.pastTenseVerb` | Default |
| Evolution | Versioned; runtime upcasts to latest | Settled |
| Version retirement | Support current and previous version (N-1) | Default |
| History | Latest state only | Settled |
| Reconnect behavior | Re-fetch snapshot on every (re)connect | Default |
| Manifest versioning | `manifestVersion` field on station and module manifests | Default |
| How stations receive repo content | `@bar/content` package (schemas + loaders) used by stations and pages | Settled |

## Back end and data

| Topic | Decision | Status |
|---|---|---|
| API | Hono on Lambda behind API Gateway (HTTP API), mounted at `/api/<module>` | Settled |
| Lambda grouping | Configurable per environment; start consolidated | Settled |
| Scheduled work | Separate Lambdas via EventBridge Scheduler | Settled |
| Real-time | AppSync Events, one channel namespace per domain, behind a transport adapter | Settled |
| Database | DynamoDB, one table per module, on-demand | Settled |
| Platform table | `room-state` table holding latest state events (snapshot) | Default |
| Data access | DynamoDB Toolbox | Settled |
| Content | Hybrid: long-form in repo; small live items in DynamoDB | Settled |
| Photos | S3, resized on upload, served via CloudFront | Settled |
| Secrets | Secrets Manager, cached in Lambda | Settled |
| Logging/tracing | Powertools for AWS Lambda (TypeScript): structured logs, correlation via event id | Default |
| Admin authentication mechanism | Not chosen; needed by the first write route | Open |

## Infrastructure and delivery

| Topic | Decision | Status |
|---|---|---|
| Cloud / region | AWS, us-west-2; certificates in us-east-1 | Settled |
| IaC | AWS CDK, central in `infra/`, driven by manifests | Settled |
| Module discovery (infra) | Glob `modules/*` | Settled |
| Stacks | Certificate (us-east-1), Stateful, Stateless, shared PreviewSite | Settled |
| Cross-stack references | CloudFormation exports (CDK automatic); removals may need a two-step deploy | Settled |
| Non-standard resources | Infra extensions: named plugins in `infra/extensions/`, referenced from manifests | Settled |
| Site hosting | S3 + CloudFront (not Amplify) | Settled |
| Environments | Single AWS account: per-PR previews, staging, production | Settled |
| Previews | One shared preview distribution, `pr-<n>.preview.<domain>`; each PR has its own backend stacks | Settled |
| Previews before the domain | Each PR also deploys its own CloudFront site (default `*.cloudfront.net` domain); switches to the shared distribution once the domain is set | Settled |
| Pipeline | GitHub Actions + OIDC; staging auto, production behind manual approval | Settled |
| Safeguards | Env prefixes/tags, scoped CI roles, RETAIN on prod data, PITR on prod | Settled |

## Workflow

| Topic | Decision | Status |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Settled |
| Tool versions | mise | Settled |
| Local backend | Personal cloud sandbox (`dev-<user>`), hotswap, auto-wired endpoints | Settled |
| Testing | Vitest; mocked unit tests + integration on previews; CDK assertions | Settled |
| Front-end gates | Playwright E2E; Lighthouse CI budgets (warn only) | Settled |
| Lint/format | ESLint + Prettier; Lefthook pre-commit | Settled |
| Commits/releases | Conventional Commits; release-please | Settled |
| Branching | Trunk-based, PR per change | Default |
| Generators | Turborepo generators: station, module, event, page; flags only | Settled |

## Foundation implementation defaults

Chosen while building the foundation where nothing above decided; each is easy to change.

| Topic | Decision | Status |
|---|---|---|
| Toolchain | Node 24 LTS, pnpm 11, TypeScript 6.0 (typescript-eslint does not support 7 yet), exact version pins | Default |
| Page definitions | `apps/web/src/page-defs/*.ts`, so discovery can validate every target against every page | Default |
| Station entry props | `StationContext` (page, path, params, manifest-derived nav and wall) | Default |
| Workshop / Liner Notes on wall and nav | Owned by `workshop-featured` and `liner-intro` (route + sleeve) | Default |
| Extra tokens | Object and status room roles; materials `--slate`, `--chalk`, `--stone` | Default |
| Opening hours | Placeholder noon–2am (`BAR_HOURS`) | Default |
| Owner time zone | `America/Los_Angeles` until set | Default |
| "Recently spun" | State event `spins.updated` (music domain) | Default |
| Runtime config | Deployed sites read `/config.json`; fixtures only in dev and `BAR_ENV=local` builds | Default |
| Real-time auth | Public connect/subscribe via a Lambda authorizer (no expiring API keys); publish IAM only | Default |
| Real-time channel | `/<domain>/room` in each domain's namespace | Default |
| CI access | Account-level `account-ci-access` stack: GitHub OIDC, release role, `pr-*`-scoped preview roles that can never touch resources tagged production, staging, sandbox or account | Default |
| Cross-stack reference strength | Pinned to `strong` (exports, as settled above); CDK now recommends `weak` for new projects, which avoids two-step removals | Default |
| Visual regression | Screenshots compared with the latest `main` run (no committed baselines); under 0.05% of pixels is noise, 2% or more needs the owner's design review | Default |
| Photo pipeline | Media bucket only; resizing Lambda not built until something uses photos | Default |

## Open items (ask before implementing)

1. **Bar name and domain.**
2. **Admin authentication mechanism** for write routes (needed by the first module with a write route; none in the foundation).

## Parked (do not build)

Device connection (Vinyl Tap, sensors), NFC lookups, plant data and retention,
cross-module data access, presence counting, family-only access, all specific
feature logic beyond placeholders.
