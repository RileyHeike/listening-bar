# Developer workflow

## Tooling

mise (node, pnpm, aws cli, cdk cli) · pnpm workspaces · Turborepo · strict TypeScript (shared base config, no `any` except marked escapes) · ESLint + Prettier · Stylelint (token rule) · Lefthook (format staged files + affected typecheck on pre-commit; commitlint on commit-msg) · Conventional Commits · release-please.

Workspace globs: `apps/*`, `packages/*`, `stations/*`, `modules/*`, `infra`, `fixtures`.
Versions are pinned exactly; pnpm refuses packages published less than a day ago.

## Local development

- `pnpm dev:site`: front end only, fixtures + control panel (local mode).
  Works offline.
- `pnpm sandbox:deploy`: deploys `dev-<user>` backend; writes endpoints to `apps/web/.env.local`.
  `pnpm sandbox:watch` hotswaps Lambda code; `pnpm sandbox:destroy` removes it.
- `pnpm dev`: site against the sandbox (the dev server proxies `/api`); the control panel can switch to sandbox mode.
- Real secrets live only in Secrets Manager; `.env.local` is git-ignored (see `apps/web/.env.example`).
- Astro 7 starts dev and preview servers in the background when it detects an AI agent; `astro dev stop` and `astro dev logs` manage them.

## Testing

| Layer | Tool | Command | Where it runs |
|---|---|---|---|
| Unit (stations render shells via the Astro Container API; packages; modules with in-memory or stubbed DynamoDB) | Vitest | `pnpm test` | local + PR |
| Contract tests (manifest + event schemas, upcasters, fixtures) | Vitest | `pnpm test` | local + PR |
| CDK assertions (safeguards, IAM scoping, naming, modules, extensions) | Vitest + CDK assertions | `pnpm test` | local + PR |
| Production build excludes dev tooling and fixtures | Vitest | `pnpm test` | local + PR |
| End-to-end | Playwright | `pnpm test:e2e` (local build, or `PLAYWRIGHT_BASE_URL`) | local + PR; preview; smoke on staging/prod |
| Integration (real DynamoDB/AppSync) | Vitest | `pnpm --filter @bar/web test:integration` with `BAR_API_URL` etc. | against PR preview |
| Generators | shell | `tools/generators/smoke.sh` | PRs touching generators |
| Performance | Lighthouse CI | | preview (warn only) |
| Visual comparison (every page, both lighting modes, every phase; fixed clock, reduced motion) | Playwright + pixelmatch | `pnpm --filter @bar/web test:visual`, then `visual:compare <baseline> <current> <out>` | PR, against `main`'s screenshots |

## Conventions

kebab-case folders · PascalCase components · role-named files (`station.ts`, `module.ts`, `routes.ts`, `entities.ts`) · trunk-based, PR per change · commit scopes match package folder names (`feat(hifi): …`), plus `infra`, `fixtures`, `generators`, `ci`, `deps`, `docs`, `repo`, `release`.

## Generators (Turborepo, flags only)

| Command | Creates |
|---|---|
| `pnpm gen station --id --name --target page:slot [--route] [--hydrate]` | station package, manifest (draft: true), shell, island (unless `--hydrate none`; default `visible`), CSS, sleeve placeholder (with `--route`), test |
| `pnpm gen module --name` | module package, manifest, example route, entities file, test |
| `pnpm gen event --type --domain --kind` | event definition with a v1 schema, registry entry, fixture, test |
| `pnpm gen page --id --route --slots` | page definition (`page-defs/`) and Astro page with a `SlotOutlet` per slot |

Missing or invalid flags exit non-zero with a usage list.
Output is formatted and installed, and passes typecheck, lint, and tests immediately (`tools/generators/smoke.sh` proves it).
See `docs/how-to/` for each.
