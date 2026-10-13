# Project progress and handoff

Snapshot as of 2026-10-12.
Start here when resuming work; `docs/implementation-plan.md` is the original plan.

## Where things stand

The foundation (all ten phases of the implementation plan) is built, tested, and deployed.
Every page still shows bracketed placeholder content and `[BAR NAME]`.

| Phase | Status |
|---|---|
| 0 Repo bootstrap | Done |
| 1 `@bar/core` + `@bar/fixtures` | Done |
| 2 `@bar/tokens` / `@bar/ui` | Done (visual matrix at `/dev/primitives`, dev only) |
| 2b `@bar/content` | Done |
| 3 Site shell | Done |
| 4 `@bar/room` (incl. AppSync transport) | Done |
| 5 Stations (18) + Playwright suite (34 tests, desktop + phone) | Done |
| 6 Control panel (dev only; absence from builds is tested) | Done |
| 7 `@bar/server` + infra | Done; sandbox, staging and production deployed |
| 8 Pipelines | Done; checks, staging and approval-gated production run on GitHub |
| 9 Generators (station, module, event, page) | Done; `tools/generators/smoke.sh` |
| 10 Docs pass | Done; `docs/how-to/`, contracts match the implementation |

`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:e2e` pass locally and in CI.

## Environments

| Environment | URL | Stacks | How it deploys |
|---|---|---|---|
| Production | https://dthhfue0q0cpk.cloudfront.net | `prod-stateful`, `prod-stateless` | Push to `main`, after staging, with RileyHeike's approval in GitHub |
| Staging | https://d2v6lgq1xw1hwq.cloudfront.net | `staging-stateful`, `staging-stateless` | Every push to `main` |
| Sandbox | local `pnpm dev` (proxies `/api`) | `dev-rileyheike-*` | `pnpm sandbox:deploy` / `sandbox:watch` / `sandbox:destroy` |
| PR previews | not yet | `pr-<n>-*` | Needs the domain (see below) |
| Account | none | `account-access`, `account-ci-access` | `cdk deploy … -c env=account` as `listening-bar-admin` |

All in AWS account 441659297085, us-west-2 (us-east-1 bootstrapped for future certificates).
Production alarms go to SNS topic `prod-alarms`, subscribed and confirmed for rileyheike@gmail.com.

## Access

- **AWS:** `aws sso login --sso-session personal` (IAM Identity Center; shared with league-site).
  - `listening-bar` profile: deploy-only `listening-bar-developer` role, for everyday work; the sandbox scripts use it automatically.
  - `listening-bar-admin` profile: AdministratorAccess, for one-time setup only.
  - Never use the root `default` profile.
- **GitHub:** `RileyHeike/listening-bar` (public).
  CI signs in to AWS through OIDC as `bar-ci-release`, which trusts GitHub's immutable subject `repo:RileyHeike@58667210/listening-bar@1414868033:…`.
  Details: `docs/infrastructure.md` ("Access", "CI access").

## Next steps

1. **Scope the budget to this project.**
   The account is shared with league-site; the deployed `listening-bar-monthly` budget ($5) is account-wide until the `project` cost allocation tag is active.
   The tag appears in billing data up to 24 hours after tagged resources exist (created 2026-10-11).
   The tag-scoped budget is in code, not yet deployed:

   ```sh
   aws sso login --sso-session personal
   aws ce update-cost-allocation-tags-status --profile listening-bar-admin --region us-east-1 \
     --cost-allocation-tags-status TagKey=project,Status=Active
   cd infra && AWS_PROFILE=listening-bar-admin pnpm exec cdk deploy account-access -c env=account
   ```

   If the first command reports "Tag keys not found", wait and retry; do not deploy the scoped budget before the tag is active (it would report $0 and never alert).

2. **Window placeholder fix (small).**
   When the snapshot has no weather (true on staging and production today), the window stays on "Looking outside…" forever.
   It should show a quiet fallback once the snapshot is ready, as the hi-fi does with "Between records".
   Agreed with the owner as worth doing; not started.

3. **Decisions only the owner can make** (open in `docs/decisions.md`):
   - The bar's name and domain.
     Needed for real URLs, PR previews and replacing `[BAR NAME]`.
     Then: set `project.domain` in `infra/config/project.ts`, deploy `-c env=account`, set repository variables `BAR_DOMAIN`, `PREVIEW_BUCKET` and `PREVIEW_DISTRIBUTION_ID` from its outputs, and validate the `pr-*`-scoped preview policies on the first preview.
   - Admin authentication for write routes (needed before anything writes data, e.g. making the contact form send).
   - Review the "Foundation implementation defaults" table in `docs/decisions.md`, and approve the contract refinements below.

4. **Make it the owner's.**
   Replace the placeholder content in `packages/content/content/`, tune the design tokens, then build the first real feature with the generators (`docs/how-to/`).

5. **Housekeeping.**
   - Release PR #2 ("release 0.1.0") is open; merging it tags 0.1.0 and writes the changelog (owner's call).
   - Dependabot PR #1 was failing because it bundled major upgrades; Dependabot now proposes minor and patch only, so close #1 if it lingers.
   - Delete the duplicate `decisions.md` at the repo root (`docs/decisions.md` is current).
   - Retire the root `default` profile in `~/.aws/config`; make sure the root user has MFA.
   - GitHub's `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19; watch the first CI run after that.

## Contract refinements to approve

The contract docs describe the implementation exactly; these go beyond the original text:

- Station entries receive a `StationContext`; page definitions live in `apps/web/src/page-defs/`.
- Stations read stores with `useRoomStore` and derive live state with `createRoomStore`.
- Modules publish with `publish(type, data, { source })` from `@bar/server`; secrets are prefixed with the environment prefix (`SECRETS_PREFIX`).
- Real-time events travel on `/<domain>/room`; one new event, `spins.updated`.

## Working notes for agents

- Toolchain: mise is not installed on this machine; use `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH` (Node 24 + pnpm 11).
- Astro 7 runs `astro dev` and `astro preview` in the background when it detects an AI agent; use `astro dev stop` and `astro dev logs`.
  Playwright starts preview with `--ignore-lock` to keep it in the foreground.
- New files matched by the eager station globs (e.g. a new `sleeve.svg`) need a dev-server restart.
- The `gh` CLI here is old: it has no `gh variable` or `gh run view --json jobs`; use `gh api`.
- Deploying anything to AWS or changing GitHub settings is outward-facing: confirm with the owner first.
