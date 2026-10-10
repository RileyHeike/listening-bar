# Foundation build progress

Snapshot as of 2026-10-10.
Phases refer to `docs/implementation-plan.md`.

## Status by phase

| Phase | Status | Notes |
|---|---|---|
| 0 Repo bootstrap | Done | pnpm 11 workspace, Turborepo, strict TS 6, ESLint 10, Prettier, Stylelint, Lefthook, commitlint, release-please. |
| 1 `@bar/core` | Done | Manifest/page/module schemas, event registry with upcasting, lighting, motion constants, API route contracts. 91 tests. |
| 1 `@bar/fixtures` | Done | Per-event fixtures (missing entry is a compile error), fixture snapshot, `stationContext()` for station tests. |
| 2 `@bar/tokens` / `@bar/ui` | Done | Three-layer tokens, Stylelint `bar/no-material-tokens`, primitives plus `SleeveArt`, `Tracklist`, `FactList`, icons. Visually checked in all modes at `/dev/primitives`. |
| 2b `@bar/content` | Done | Markdown/YAML loaders with Zod validation; bracketed placeholder content. |
| 3 Site shell | Done | Astro 7 static site, station glob discovery, build fails with every manifest problem listed, derived nav/wall/draft pages. |
| 4 `@bar/room` | Done except AppSync | Stores, persistence, lighting clock, pre-paint boot script, dispatch with validation/upcasting, order-safe room stores, local transport, reconnect → snapshot refetch, ticker, lifecycle, boundary, audio skeleton, typed API client. AppSync transport is Phase 7. |
| 5 Stations | Mostly done | All 18 stations implemented and tested; Playwright E2E smoke suite not written yet. |
| 6 Control panel | Not started | `apps/web/src/dev/control-panel/mount.ts` is a stub; dev-tools integration already injects it in `astro dev` only. |
| 7 `@bar/server` + infra | Not started | |
| 8 Pipelines | Not started | |
| 9 Generators | Partly done | `pnpm gen station`, `page`, `event` work (flags only, output passes checks). `module` generator waits on `@bar/server`. `generators.yml` not written. |
| 10 Docs pass | Not started | |

`pnpm typecheck`, `pnpm lint` and `pnpm test` pass across all 25 packages.

## Next steps

1. Fix the known issues below.
2. Phase 5: Playwright smoke tests (wall → pages with sleeve morph, JS disabled, reduced motion, lights up).
3. Phase 6: control panel, plus a test asserting it and fixtures are absent from a `BAR_ENV=production` build.
4. Phase 7: `@bar/server`, CDK stacks, AppSync transport, sandbox scripts, then the `module` generator.
5. Phases 8 and 10.

## Known issues

- `/liner-notes` overflows horizontally by about 20px at a 400px viewport (the `liner-intro` text column).
  Making the availability pill wrap did not fix it; check the heading and grid.
- The room page measures 401px at 400px wide, possibly from the noren rod's negative margin.
- In `astro dev`, new files matched by eager station globs (e.g. a new `sleeve.svg`) need a dev-server restart.
- The hi-fi platter, VU needles, view-transition morphs and entrance motion are implemented but not yet verified in a real browser run.

## Implementation decisions to review

These were not covered by `docs/decisions.md`; each is easy to change.

- **Versions:** Node 24 LTS, pnpm 11, TypeScript 6.0 (typescript-eslint does not support 7 yet), Motion 12.43 (13/14 are days old), Prettier 3.9.9 (pnpm's minimum release age rejected 3.9.10).
- **Page definitions** live in `apps/web/src/page-defs/*.ts` so discovery can validate every target against every page.
- **Stations receive a `StationContext`** (page, params, manifest-derived nav and wall) as props; this is how the header and record wall get manifest data without importing apps/web.
- **Workshop and Liner Notes on the wall/nav** come from `workshop-featured` and `liner-intro`, which own those routes.
- **Extra role tokens:** object roles (`--room-wood`, `--room-metal`, `--room-paper`, `--room-slate`, …) and status roles (`--room-status-*`), so stations never touch materials.
  Added materials `--slate`, `--chalk`, `--stone`.
- **Opening hours** placeholder: `BAR_HOURS` noon to 2am in `packages/core/src/lighting.ts`.
- **Default time zone** `America/Los_Angeles` (`PUBLIC_BAR_TIMEZONE`).
- **Extra event** `spins.updated` (music domain) for the hi-fi's "Recently spun" list.
- **Runtime config:** deployed sites will read `/config.json` (endpoints); `BAR_ENV=local` builds and `astro dev` use fixtures.
- **Planned for Phase 7:** AppSync subscribe auth via a Lambda authorizer (avoids API-key expiry), and an account-level CI/OIDC stack in addition to the four app stacks.

## Housekeeping

- The repo was `git init`-ed (Lefthook needs it); nothing is committed yet.
- `decisions.md` at the repo root duplicates `docs/decisions.md`.
- `astro` is a root dev dependency so repo-level lint can type `.astro` imports.
