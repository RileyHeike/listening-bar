# Add a station

A station is a front-end feature rendered into a page slot.
Read `docs/contracts/station.md` first.

## 1. Generate it

```sh
pnpm gen station --id tea-shelf --name "Tea shelf" --target room:wall
```

Flags:

| Flag | Required | Meaning |
|---|---|---|
| `--id` | yes | kebab-case id; also the package folder and view-transition name |
| `--name` | yes | human name for the wall and nav |
| `--target` | yes | `page:slot` or `layout:slot` |
| `--route` | no | a route the station owns, e.g. `/tea`; adds `sleeve.svg` and a wall sleeve |
| `--hydrate` | no | `load`, `idle`, `visible` (default) or `none` |

The generator creates `stations/<id>/` with a draft manifest, a static shell, an island (unless `--hydrate none`), CSS, a test, and runs `pnpm install`.
The output passes `pnpm typecheck`, `pnpm lint` and `pnpm test` as generated.

## 2. Build the static shell

Edit `src/index.astro`.
It receives the `StationContext` as props (`pageId`, `path`, `params`, `site`).
Render complete, dimension-stable HTML: the page must look finished with JavaScript off.
Read repo content only through `@bar/content` loaders, in the frontmatter.

## 3. Add live behaviour (optional)

Islands are React components imported in `index.astro` with the `client:*` directive that matches the manifest's `hydrate`.
Wrap the live part in `StationBoundary` with the static markup as `fallback`.
Read live data from `@bar/room` stores with `useRoomStore`; derive station state from events with `createRoomStore` in `src/store.ts`, and list those event types in the manifest's `listens`.
Gate decorative motion with `useMotion()`; run frame loops with `useTicker`, only while `useInView` and `useStationLifecycle` say the station is visible and entered.

## 4. Style with role tokens

Use `--room-*`, `--signature` and the type, space and motion tokens.
Raw colors and material tokens fail `pnpm lint`.

## 5. Ship it

Drafts appear only in local, sandbox and preview builds.
When the station is ready, set `draft: false` (or remove the line).
A non-draft station with a `route` must target a slot on the page at that route.
Check reduced motion, lights up and no-JS rendering, then run `pnpm test:e2e`.
