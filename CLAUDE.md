# CLAUDE.md — [BAR NAME]: a listening bar on the internet

A personal website designed as a Japanese jazz-kissa listening bar in a
mid-century modern register. Public bio, project portfolio ("the Workshop"),
professional page ("Liner Notes"), and a growing set of playful, live features.

This file is the entry point for coding agents. Read it fully before any task,
then read the docs it points to for the area you are working in.

## Read before working

| If you are touching… | Read |
|---|---|
| Anything | `docs/decisions.md` (what is settled, open, and parked) |
| Overall structure | `docs/architecture.md` |
| A station (front-end feature) | `docs/contracts/station.md`, `docs/frontend.md`, `docs/design-system.md` |
| A module (back-end feature) | `docs/contracts/module.md`, `docs/backend.md` |
| Events / real-time | `docs/contracts/events.md` |
| CDK, environments, CI | `docs/infrastructure.md` |
| Tooling, tests, generators | `docs/workflow.md` |
| What to build next | `docs/implementation-plan.md` |

## Golden rules

1. **Do not make product or architecture decisions.** Everything settled is in
   `docs/decisions.md`. If a task requires a choice that is listed as *Open* or
   *Parked*, or is not covered at all, stop and ask the owner. Present options
   with tradeoffs; never pick silently.
2. **Respect package boundaries.** Stations never import other stations.
   Modules never import other modules. Shared code lives in `packages/*`.
   A package may only import what its `package.json` declares.
3. **Contracts are normative.** Manifests and events are validated with Zod
   schemas in `@bar/core`. Never bypass validation; never publish an
   unregistered event type.
4. **Static shell first.** Every station renders complete, dimension-stable
   HTML before any JavaScript runs. Islands enhance; they never create layout.
5. **Motion goes through the motion switch.** All decorative animation checks
   `useMotion()` (or `[data-motion]` in CSS). Animate only `transform`,
   `opacity` (and `filter` sparingly). Frame loops use the shared ticker.
6. **Aesthetics live in tokens.** Station CSS uses room-role tokens
   (`--room-*`, `--signature`, type/space/motion tokens), never raw hex values
   or material tokens.
7. **No real feature logic yet.** The foundation ships placeholder stations on
   fixture data. Do not implement device, plant, NFC, presence, or
   family-access features; they are parked.
8. **Use the generators** (`pnpm gen …`) to create stations, modules, events,
   and pages. Do not hand-scaffold them.

## Commands

```
mise install                 # pinned node, pnpm, aws cli, cdk cli
pnpm install
pnpm dev                     # site (+ sandbox endpoints if deployed)
pnpm dev:site                # front end only, fixtures + control panel
pnpm test                    # vitest across the workspace
pnpm typecheck
pnpm lint
pnpm gen station --id <id> --name "<Name>" --target <page>:<slot>
pnpm gen module --name <name>
pnpm gen event --type <domain.verb> --domain <domain> --kind state|moment
pnpm gen page --id <id> --route </path> --slots a,b,c
pnpm sandbox:deploy          # deploy personal dev-<user> backend
pnpm sandbox:watch           # cdk watch (hotswap) against the sandbox
```

## Definition of done (every task)

- `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
- New code follows the relevant contract doc; contract docs updated if a
  contract changed (contract changes require owner approval first).
- Static shells render without JavaScript; reduced-motion and lights-up modes
  checked for any visual change.
- Commit messages follow Conventional Commits (`feat(station-hifi): …`).
