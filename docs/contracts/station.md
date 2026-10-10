# Station contract (normative)

A station is one self-contained front-end feature, packaged as a workspace
package and rendered into a page-defined slot.

## Package layout

```
stations/<id>/
├─ package.json        name "@bar/station-<id>"; peerDeps: astro, react, react-dom, @bar/room, @bar/ui, @bar/content, @bar/core, @bar/tokens
├─ station.ts          default export: defineStation({...})
├─ src/
│  ├─ index.astro      entry: static shell; imports islands WITH their client:* directive
│  ├─ <Name>.tsx       island(s)
│  ├─ store.ts         optional station-local state + event handlers
│  └─ <name>.css
├─ fixtures.ts         optional placeholder data (validated)
└─ <name>.test.ts
```

Astro requires `client:*` directives on statically imported components, so
**hydration directives live inside the station's own `index.astro`**, never in
the page that renders it. The page renders the entry dynamically without a
directive.

## Manifest schema

Defined in `@bar/core` as `StationManifestSchema` (Zod). Shape:

```ts
type StationManifest = {
  manifestVersion: 1;
  id: string;                     // kebab-case, unique; used for view-transition names
  name: string;                   // human name (wall, nav)
  blurb?: string;                 // one line under the sleeve
  targets: `${string}:${string}`[]; // "page:slot" or "layout:slot"
  order?: number;                 // within slot / wall / nav, ascending
  route?: string;                 // if the station owns a page
  sleeve?: { src: string };       // with route → appears on the record wall
  nav?: boolean;                  // default: true when route is set
  draft?: boolean;                // dev + previews only; gets a "being built" page
  hydrate: 'load' | 'idle' | 'visible' | 'none'; // documentation; must match index.astro
  listens?: EventType[];          // drives per-page channel subscriptions
};
```

## Discovery

`apps/web` globs `../../stations/*/station.ts` and
`../../stations/*/src/index.astro` (`import.meta.glob`, eager). Vite
`server.fs.allow` includes the repo root. Manifests are validated at build;
the build fails on: duplicate ids, a target naming an undeclared page/slot,
`hydrate` mismatching the entry, or `draft: false` without required fields.

## Pages and slots

Pages declare slots with `definePage({ id, slots })` and render them with
`<SlotOutlet name="…" />`. Layouts may declare slots (`layout:<slot>`) for
site-wide pieces. Stations render in a slot sorted by `order`.

## Rules

- **Static shell first**: complete HTML, reserved dimensions, no layout shift
  on hydration. Live values show a neutral placeholder until the snapshot fills
  them.
- **Error boundary**: each island is wrapped (`<StationBoundary>` from
  `@bar/room`); on error it falls back to the static shell.
- **Data**: live data only through `@bar/room` stores; API reads only through
  the typed client in `@bar/room`. No direct `fetch` to other origins.
- **Lifecycle**: use `useStationLifecycle({ onEnter, onLeave })` to start/stop
  ambient work across client-router navigations.
- **Motion**: `useMotion()` gates decorative motion; categories per
  `docs/frontend.md`.
- **Styling**: role tokens only (see design-system.md).
- **No cross-imports** between stations; shared components go to `@bar/ui`.
- **Repo content** (projects, roles, tour write-ups…): read only through
  `@bar/content` loaders (e.g. `getProjects()`, `getRoles()`), in the
  station's `index.astro` at build time. Never read files or Astro content
  collections directly. Placeholder content lives in `@bar/content` with
  bracketed placeholder copy.
