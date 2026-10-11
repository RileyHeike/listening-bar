# Front end

## Stack

Astro (static output) · React islands · Astro client router (`<ClientRouter />`) · Motion for React (`LazyMotion`; features loaded per station, e.g. `domMax` for the shelf's layout animation) · nanostores in `@bar/room`.
Verify current APIs against official docs before implementing; do not rely on memory for version-specific details.

## Pages (foundation)

| Page | Route | Slots | Stations |
|---|---|---|---|
| Room | `/` | entrance, counter, hifi, wall, menu, window | noren, counter, hifi, record-wall, chalkboard, window |
| Workshop | `/workshop` | header, featured, shelf | workshop-featured (owns the route and wall sleeve), workshop-shelf; the header slot falls back to the page title |
| Project | `/workshop/[slug]` | album | workshop-album |
| Liner Notes | `/liner-notes` | intro, discography, contact | liner-intro (owns the route and wall sleeve, with the meishi), discography, contact-form (UI only) |
| Layout | all | header, footer, overlay | site-header (nav, open sign, lights up), site-footer |
| Draft stub | `/<route>` | none | automatic page for `draft: true` stations with a route |

Draft sleeves on the wall: Crate, Tours, Notebook, House Band.
Page definitions live in `apps/web/src/page-defs/`.

## Room runtime (`@bar/room`)

Started once per page load by a bundled module script in the base layout (`src/scripts/room.ts`).
Module state persists across client-router navigations, so stores, subscriptions and audio live for the whole visit.

- **Boot script**: an inline `<head>` script (`bootScript` from `@bar/room/boot`) sets `data-lights`, `data-side`, `data-phase` and `data-motion` before first paint from saved preferences and the owner's clock.
- **Stores**: `$lights` (dim/up), `$side` (A/B), `$sound`, `$phase`, `$open`, `$reducedMotion`, `$motion`, `$live` (connection status), `$snapshotStatus`, plus event-driven stores built with `createRoomStore` (on `onRoomEvent`).
  Islands read stores with `useRoomStore`.
- **Persistence**: lights, side and sound are saved per visitor (localStorage).
- **Lighting clock**: phase computed every minute in the owner's time zone (`PUBLIC_BAR_TIMEZONE`): after-hours 2–6, dawn 6–9, day 9–17, golden 17–19, evening 19–22, night 22–2.
  Phase changes drift over `--dur-light` (`data-drifting`); page swaps stay instant.
  The open sign follows `BAR_HOURS` in `@bar/core` (placeholder: noon to 2am).
- **Attributes**: `data-lights`, `data-side`, `data-phase`, `data-motion` on `<html>`, re-applied on `astro:after-swap`; `data-tone` is rendered by the page.
- **Snapshot + transport**: see contracts/events.md.
- **Runtime config**: deployed sites read `/config.json` (`{ apiBase, realtime }`); production and staging serve it from the site bucket, previews from their prefix.
  `astro dev` and `BAR_ENV=local` builds use the fixture snapshot instead (never shipped elsewhere; a test asserts it).
- **Audio manager**: Web Audio; master gain follows `sound`; channels `ambient` and `effects`; starts only after a user gesture; mutes when the tab is hidden; persists across navigation.
  No sound assets in the foundation.
- **Typed API client**: `api.request(route, body?)` for routes declared in `@bar/core`'s `apiRoutes`; the only way stations read the API.

## Motion system

- `useMotion()` → `false` when `prefers-reduced-motion` or lights up.
  CSS mirror: `[data-motion="off"]`; the base styles also stop animations and transitions there and under the OS setting (covers visitors without JavaScript).
- Tokens: durations, easings and springs exported from `@bar/tokens` for CSS and JS (kept in sync by a test).
- Categories:
  - **Entrance**: the noren settling; once per session (`claimEntrance`, sessionStorage).
  - **Responsive**: answers an action (sleeve pull and view-transition morph into the destination hero, Side A/B flip, meishi flip, shelf reshuffle, lights-up snap).
  - **Ambient**: data-driven loops (platter spin-up/down with inertia at a true 33⅓ RPM = 1.8 s/rev, tonearm, VU needles while playing, rain, phase light drift).
    Pauses when off-screen (`useInView`), when the tab is hidden (ticker), and on `onLeave`.
- Animate only transform/opacity (filter sparingly).
  One shared rAF ticker in `@bar/room` (`useTicker`).
- Sleeve morphs: the wall sleeve's cover and the destination hero share `view-transition-name: sleeve-<station id>`; shelf items and album covers share `project-<slug>`.

## Control panel (dev only)

Floating panel injected only by `astro dev` (dev-tools integration; never in builds, asserted by a production-build test).
Controls: phase override, lights, side, sound, reduced-motion simulation, and firing any registered event with its fixtures.
Modes: **local** (in-browser bus, mirrored to other tabs) or **sandbox** (POST to the dev-only publish route, which publishes through AppSync).
Sandbox mode is available when `pnpm sandbox:deploy` has written endpoints to `apps/web/.env.local`; the dev server proxies `/api` to the sandbox.
A matrix of every `@bar/ui` primitive in every lighting mode lives at `/dev/primitives`.

## Performance

Static HTML first; islands hydrate as late as allowed; React loaded once per page; Motion lazily; self-hosted fonts (Jost, Shippori Mincho, DM Mono, Caveat via Fontsource) with `font-display: swap`; images with explicit dimensions.
Lighthouse CI budgets warn only (`apps/web/lighthouserc.json`).
