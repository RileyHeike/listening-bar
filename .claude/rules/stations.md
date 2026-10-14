---
paths:
  - 'stations/**'
  - 'apps/web/src/**'
  - 'packages/ui/**'
---

# Stations and the site

Contract: `docs/contracts/station.md`; guides: `docs/frontend.md`, `docs/design-system.md`, `docs/how-to/add-a-station.md`.

- Create stations and pages with the generators (`pnpm gen station …`, `pnpm gen page …`), never by hand.
- A station never imports another station; shared code belongs in `packages/*`, and a package imports only what its `package.json` declares.
- Static shell first: `src/index.astro` renders complete, dimension-stable HTML before JavaScript runs.
  Islands enhance; they never create layout.
  Hydration directives (`client:*`) live in the station's own `index.astro`, not in the page.
- Read room state with `useRoomStore`; derive live state with `createRoomStore`.
  Never reference a transport implementation directly.
- Decorative motion checks `useMotion()` (or `[data-motion]` in CSS), animates only `transform` and `opacity` (`filter` sparingly), and frame loops use the shared ticker.
- Check every visual change with reduced motion and with lights up.
- Every station has a shell render test (Astro Container API); add Playwright coverage for behaviour.
- Nothing parked: no device, plant, NFC, presence or family-access features.
