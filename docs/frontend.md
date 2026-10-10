# Front end

## Stack

Astro (static output) · React islands · Astro client router
(`<ClientRouter />`) · Motion for React (`LazyMotion` + `domAnimation`;
heavier features loaded per station) · nanostores-style stores in `@bar/room`.
Verify current APIs against official docs before implementing; do not rely on
memory for version-specific details.

## Pages (foundation)

| Page | Route | Slots | Placeholder stations |
|---|---|---|---|
| Room | `/` | entrance, counter, hifi, wall, menu, window | noren, counter, hifi, record-wall, chalkboard, window |
| Workshop | `/workshop` | header, featured, shelf | workshop-featured, workshop-shelf |
| Project | `/workshop/[slug]` | album | workshop-album |
| Liner Notes | `/liner-notes` | intro, discography, contact | liner-intro (with meishi), discography, contact-form (UI only) |
| Layout | all | header, footer, overlay | site-header (nav, open sign, lights up), site-footer |
| Draft stub | `/<route>` | — | auto page for `draft: true` stations with a route |

Draft sleeves on the wall: Crate, Tours, Notebook, House Band.

## Room runtime (`@bar/room`)

Mounted once in the base layout with `transition:persist`.

- **Stores**: `lights` (dim/up), `side` (A/B), `sound` (bool), `phase`,
  `reducedMotion`, `live` status, plus event-driven stores registered via
  `onRoomEvent(type, reducer)`.
- **Persistence**: lights, side, sound saved per visitor (localStorage).
- **Lighting clock**: phase computed every minute in the owner's timezone
  (`PUBLIC_BAR_TIMEZONE`): after-hours 2–6, dawn 6–9, day 9–17, golden
  17–19, evening 19–22, night 22–2. Written to `<html data-phase>`.
- **Attributes**: `data-lights`, `data-side`, `data-phase`, `data-motion`,
  `data-tone` on `<html>`; re-applied on `astro:after-swap`.
- **Snapshot + transport**: see contracts/events.md.
- **Audio manager**: Web Audio; master gain tied to `sound`; channels
  `ambient` and `effects`; starts only after a user gesture; mutes when the tab
  is hidden; persists across navigation. No sound assets in the foundation.
- **Typed API client**: the only way stations read the API.

## Motion system

- `useMotion()` → `false` when `prefers-reduced-motion` or lights up.
  CSS mirror: `[data-motion="off"]`.
- Tokens: durations, easings, springs exported from `@bar/tokens` for both
  CSS and JS.
- Categories:
  - **Entrance**: the noren parting; once per session (sessionStorage).
  - **Responsive**: answers an action (sleeve pull + view-transition morph
    into the destination page hero, Side A/B flip, meishi flip, shelf filter
    reshuffle, lights-up snap).
  - **Ambient**: data-driven loops (platter spin-up/down with inertia at a
    true 33⅓ RPM = 1.8 s/rev, tonearm, VU needles while playing, rain,
    phase light drift). Must pause when off-screen (IntersectionObserver) or
    tab hidden, and on `onLeave`.
- Animate only transform/opacity (filter sparingly). One shared rAF ticker in
  `@bar/room`.

## Control panel (dev only)

Floating panel in `pnpm dev`, never in builds for staging/production.
Controls: phase override, lights, side, sound, reduced-motion simulation, and
fire any registered event with fixture payloads. Mode toggle: **local**
(inject via local transport) or **sandbox** (POST to a dev-only route that
publishes through AppSync).

## Performance

Static HTML first; islands hydrate as late as allowed; React loaded once per
page; Motion lazily; self-hosted fonts (Jost, Shippori Mincho, DM Mono,
Caveat) with `font-display: swap`; images AVIF/WebP with explicit dimensions.
Lighthouse CI budgets warn only.
