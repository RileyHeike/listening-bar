# Architecture

## Shape

A thin, stable core with many small, self-contained pieces plugged into it.
Adding a feature means adding a package, not editing the core.

- **Stations** (`stations/*`): front-end features rendered into page slots.
- **Modules** (`modules/*`): back-end features; routes, jobs, data, events.
- **Packages** (`packages/*`): the only shared code.
- **Infra** (`infra/`): one CDK app that discovers modules and provisions them.

Stations and modules never import each other. They meet through two contracts:
the **manifest** (what a piece is and needs) and the **event registry** (typed,
versioned live data).

## Repo layout

```
listening-bar/
├─ apps/web/                 Astro site: pages, layouts, control panel, glue
├─ stations/<id>/            one package per station (@bar/station-<id>)
├─ modules/<name>/           one package per module (@bar/module-<name>)
├─ packages/
│  ├─ core/                  isomorphic contracts: Zod schemas (manifests, events), lighting, motion constants
│  ├─ room/                  browser runtime: stores, transport, snapshot, useMotion, lifecycle, audio
│  ├─ ui/                    shared React/Astro primitives (Sleeve, Button, Pill…)
│  ├─ content/               repo content: Zod schemas, loaders, content files (projects, roles, menu seed)
│  ├─ server/                server glue: Hono builder, DynamoDB Toolbox client, publisher, secrets, logging
│  └─ tokens/                design tokens (CSS + TS export)
├─ infra/                    CDK app: bin/, stacks/, constructs/, config/<env>.ts
├─ tools/generators/         turbo gen templates
├─ fixtures/                 Zod-validated fixture data for stations and tests
├─ .github/workflows/
├─ docs/
└─ CLAUDE.md
```

Dependency direction (allowed imports only):

```
stations/*  →  @bar/room, @bar/ui, @bar/content, @bar/core, @bar/tokens
apps/web    →  stations/* (via glob), @bar/room, @bar/ui, @bar/content, @bar/core, @bar/tokens
@bar/content → @bar/core
modules/*   →  @bar/server, @bar/core
infra       →  @bar/core (manifest schemas), modules/* manifests (via glob), infra/extensions
@bar/room   →  @bar/core
@bar/server →  @bar/core
```

## Runtime picture

```mermaid
flowchart LR
  subgraph Browser
    Shell[Static HTML shells] --> Islands[React islands]
    Islands <--> Room[@bar/room stores]
    Room <--> Transport[Transport adapter]
  end
  CF[CloudFront] --> S3[(Site bucket)]
  CF -- /api/* --> APIGW[API Gateway] --> Lambda[Lambda: Hono + modules]
  Lambda --> DDB[(Module tables)]
  Lambda --> State[(room-state table)]
  Lambda -- HTTP publish --> AppSync[AppSync Events]
  Transport <-- WebSocket per domain --> AppSync
  Room -- GET /api/room/snapshot --> CF
  Sched[EventBridge Scheduler] --> Jobs[Job Lambdas] --> DDB
```

### Page load sequence

1. CloudFront serves static HTML. Every station's shell is complete and
   dimension-stable; live content shows a neutral placeholder.
2. Islands hydrate per their manifest strategy (`load` / `idle` / `visible` /
   `none`).
3. `@bar/room` fetches `/api/room/snapshot`, validates and upcasts each
   envelope, and dispatches them into stores. Placeholders fill in.
4. The transport subscribes to the AppSync channel namespaces needed by the
   stations on the current page (from their manifests' `listens`).
5. On reconnect, the snapshot is fetched again before resuming.

### Publishing an event (server)

Module handler → `publish(type, data)` from `@bar/server`, which validates
against the registry, wraps the envelope, writes it to `room-state` if
`kind: state`, and publishes to the AppSync namespace for its domain.

## Environments

| Env | Front end | Back end |
|---|---|---|
| sandbox | local `pnpm dev` | `dev-<user>` stacks |
| preview | shared PreviewSite distribution, `pr-<n>.preview.<domain>` | `pr-<n>` stacks |
| staging | own distribution | `staging` stacks |
| production | own distribution, apex domain | `prod` stacks |

All in one AWS account, us-west-2 (certificates in us-east-1).
