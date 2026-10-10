# Developer workflow

## Tooling

mise (node, pnpm, aws cli, cdk cli) · pnpm workspaces · Turborepo · strict
TypeScript (shared base config, no `any` except marked escapes) · ESLint +
Prettier · Stylelint (token rule) · Lefthook (format staged + quick typecheck
pre-commit; commitlint on commit-msg) · Conventional Commits · release-please.

Workspace globs: `apps/*`, `packages/*`, `stations/*`, `modules/*`, `infra`.

## Local development

- `pnpm dev:site`: front end only, fixtures + control panel (local mode).
  Works offline.
- `pnpm sandbox:deploy`: deploys `dev-<user>` backend; writes endpoints to
  `apps/web/.env.local`. `pnpm sandbox:watch` hotswaps Lambda code.
- `pnpm dev`: site against the sandbox; control panel can switch to sandbox
  mode.
- Real secrets live only in Secrets Manager; `.env.local` is git-ignored.

## Testing

| Layer | Tool | Where it runs |
|---|---|---|
| Unit (stations, packages, modules with mocked DynamoDB) | Vitest | local + PR |
| Contract tests (manifest + event schemas, upcasters) | Vitest | local + PR |
| CDK assertions (safeguards, IAM scoping, naming) | Vitest + CDK assertions | local + PR |
| Integration (real DynamoDB/AppSync) | Vitest | against PR preview |
| End-to-end | Playwright | preview; smoke subset on staging/prod |
| Performance | Lighthouse CI | preview (warn only) |

## Conventions

kebab-case folders · PascalCase components · role-named files (`station.ts`,
`module.ts`, `routes.ts`, `entities.ts`) · trunk-based, PR per change ·
commit scopes match package names without prefix (`feat(hifi): …`).

## Generators (Turborepo, flags only)

| Command | Creates |
|---|---|
| `pnpm gen station --id --name --target page:slot [--route] [--hydrate]` | station package, manifest (draft: true), shell, island, lifecycle hooks, sleeve placeholder, test |
| `pnpm gen module --name` | module package, manifest, example route, entities file, test |
| `pnpm gen event --type --domain --kind` | registry entry with v1 schema, fixture, test |
| `pnpm gen page --id --route --slots` | Astro page with `definePage` + `SlotOutlet`s |

Missing flags → exit non-zero with a usage list. Output must pass typecheck,
lint, and tests immediately.
