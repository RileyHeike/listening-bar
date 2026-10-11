# Foundation build progress

Snapshot as of 2026-10-11.
Phases refer to `docs/implementation-plan.md`.

## Status by phase

| Phase | Status | Notes |
|---|---|---|
| 0 Repo bootstrap | Done | |
| 1 `@bar/core` + `@bar/fixtures` | Done | |
| 2 `@bar/tokens` / `@bar/ui` | Done | Visual matrix at `/dev/primitives` (dev only). |
| 2b `@bar/content` | Done | |
| 3 Site shell | Done | |
| 4 `@bar/room` | Done | Includes the AppSync transport (Phase 7). |
| 5 Stations | Done | 18 stations; Playwright smoke suite (34 tests, desktop + phone). |
| 6 Control panel | Done | Absence from production builds is tested. |
| 7 `@bar/server` + infra | Done | Sandbox `dev-rileyheike` deployed as the developer role; integration tests pass against it; sandbox mode updates a second browser live over AppSync. |
| 8 Pipelines | Written, not run | Workflows pass actionlint; they need a GitHub repository, the account stacks and repository variables before the deploy jobs run. |
| 9 Generators | Done | station, module, event, page; `tools/generators/smoke.sh` proves the output passes every check. |
| 10 Docs pass | Done | `docs/how-to/`; contract docs updated to match the implementation. |

`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:e2e` pass.

## To finish the foundation

1. **GitHub:** push the repository, set `project.githubRepository` in `infra/config/project.ts`, create `staging` and `production` Environments (required reviewers on production), and set the `AWS_ACCOUNT_ID` repository variable.
2. **Domain (open decision):** once named and registered, set `project.domain`, deploy `-c env=account`, and set `BAR_DOMAIN`, `PREVIEW_BUCKET` and `PREVIEW_DISTRIBUTION_ID` from its outputs to turn on previews.
   Validate the `pr-*`-scoped preview policies on the first preview.

## Account setup (done 2026-10-11)

Account 441659297085: CDK bootstrapped in us-west-2 (already, shared) and us-east-1; `account-access` deployed (developer role, $5 budget to rileyheike@gmail.com); profiles `listening-bar-admin` and `listening-bar` added to `~/.aws/config` (backup alongside it).
The sandbox `dev-rileyheike` is running (about $0 idle); `pnpm sandbox:destroy` removes it.

## Contract refinements to approve

The contract docs now describe the implementation exactly; these are the refinements beyond the original text:

- Station entries receive a `StationContext`; page definitions live in `apps/web/src/page-defs/`.
- Stations read stores with `useRoomStore` and derive live state with `createRoomStore`.
- Modules publish with `publish(type, data, { source })`; secrets are prefixed with the environment prefix (`SECRETS_PREFIX`).
- Real-time events travel on `/<domain>/room`; one new event, `spins.updated`.

See also the "Foundation implementation defaults" table in `docs/decisions.md`.

## Housekeeping

- `decisions.md` at the repo root duplicates `docs/decisions.md` (and lacks the new defaults table); consider deleting the root copy.
- `AGENTS.md` is written by Turborepo for AI agents; it recommends keeping it committed.
