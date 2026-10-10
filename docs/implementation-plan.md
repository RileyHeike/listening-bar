# Implementation plan (foundation)

Work phase by phase. Each task should be one PR with passing checks. Stop and
ask the owner whenever a task touches an **Open** item in decisions.md.

## Phase 0 — Repo bootstrap
- mise config; pnpm workspace (apps, packages, stations, modules, infra);
  Turborepo pipeline (build, dev, test, typecheck, lint).
- Shared tsconfig (strict), ESLint + Prettier, Stylelint, Lefthook,
  commitlint, release-please config, `.gitignore`, CLAUDE.md, docs/.
- **Done when**: `pnpm install && pnpm typecheck && pnpm lint && pnpm test`
  succeed on an empty workspace.

## Phase 1 — `@bar/core` contracts
- Zod schemas: StationManifest, ModuleManifest, PageDefinition, Envelope.
- Event registry (`defineEvent`, versions, upcasters, domain, kind) with the
  foundation event set and fixtures.
- Lighting (phase schedule, owner-timezone hour, open/closed) and motion
  constants.
- **Done when**: unit tests cover validation failures, upcasting chains,
  phase boundaries (including midnight wrap).

## Phase 2 — `@bar/tokens` and `@bar/ui`
- tokens.css (three layers, `@property` registrations) + TS export of motion
  and scale tokens.
- `@bar/ui` primitives: Button, Pill, Sleeve (image + name + blurb, view
  transition name), Cassette, StatusDot, Crest.
- Stylelint token rule for station CSS.
- **Done when**: a fixture page renders every primitive in all phases, paper
  tone, and lights up.

## Phase 2b — `@bar/content`
- Zod schemas and loaders for projects, roles, and the menu seed; placeholder
  content with bracketed copy matching design-system.md.
- **Done when**: loaders are typed, validated at build, and unit tested.

## Phase 3 — Site shell (`apps/web`)
- Astro + React + client router; base layout with header/footer/overlay
  slots; `definePage`, `SlotOutlet`; station glob discovery with build-time
  validation; nav/wall/draft pages derived from manifests.
- Pages: Room, Workshop, Workshop project, Liner Notes.
- **Done when**: a dummy station renders in a slot; a bad target fails the
  build with a clear error.

## Phase 4 — `@bar/room` runtime
- Stores + persistence; lighting clock; `<html>` attributes incl.
  after-swap; `useMotion`; shared ticker; `useStationLifecycle`;
  `StationBoundary`; transport interface + `local` implementation; snapshot
  loader (fixture snapshot when no API configured); event dispatch with
  validation/upcasting; audio manager skeleton (no assets); typed API client.
- **Done when**: unit tests for stores, dispatch, upcasting on receipt,
  reconnect → snapshot refetch.

## Phase 5 — Placeholder stations
Use `pnpm gen station` once Phase 9 exists; until then hand-create following
the contract exactly. Stations: site-header, site-footer, noren, counter,
hifi, record-wall, chalkboard, window, workshop-featured, workshop-shelf,
workshop-album, liner-intro, discography, contact-form; draft sleeves for
crate, tours, notebook, house-band.
- **Done when**: every page matches design-system.md on fixtures, shells
  render with JS disabled, reduced motion and lights up verified, Playwright
  smoke tests navigate the wall → pages with the sleeve morph.

## Phase 6 — Control panel
- Dev-only panel; phase/lights/side/sound/reduced-motion overrides; fire any
  registered event with fixtures; local mode (sandbox mode stubbed until
  Phase 7).
- **Done when**: excluded from production builds (test asserts absence).

## Phase 7 — `@bar/server` + infrastructure
- `@bar/server`: buildApp, publish (validate → room-state → AppSync),
  snapshot route, dev publish route (non-prod only), getSecret, logger.
- CDK app: certificate, stateful, stateless, preview-site stacks;
  ModuleConstruct (tested with a fixture module in `infra/test`);
  `defineExtension` mechanism (tested with a fixture extension); AppSync
  Events API; CloudFront `/api/*` routing; safeguards.
- AppSync transport implementation in `@bar/room`; sandbox scripts
  (`sandbox:deploy`, `sandbox:watch`, endpoint wiring).
- **Done when**: CDK assertion tests pass; sandbox deploy works; control
  panel sandbox mode updates a second browser tab live.

## Phase 8 — Pipelines
- pr.yml, pr-close.yml, main.yml, release.yml, generators.yml; OIDC roles
  (scoped preview role); Lighthouse CI config (warn).
- **Done when**: a PR produces a working `pr-<n>.preview` URL and tears it
  down on close; main deploys to staging and waits for approval.

## Phase 9 — Generators
- turbo gen: station, module, event, page; flags only; templates in
  `tools/generators`.
- **Done when**: generators.yml builds and tests each generator's output.

## Phase 10 — Docs pass
- docs/how-to: add a station, add a module, add an event, add a page; update
  contract docs to match implementation exactly.
