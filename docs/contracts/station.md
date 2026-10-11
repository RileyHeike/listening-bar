# Station contract (normative)

A station is one self-contained front-end feature, packaged as a workspace package and rendered into a page-defined slot.
Create stations with `pnpm gen station` (see `docs/how-to/add-a-station.md`).

## Package layout

```
stations/<id>/
├─ package.json        name "@bar/station-<id>"; peerDeps: astro, react, react-dom, @bar/room, @bar/ui, @bar/content, @bar/core, @bar/tokens
├─ station.ts          default export: defineStation({...})
├─ sleeve.svg          when the station has a route and a sleeve
├─ src/
│  ├─ index.astro      entry: static shell; imports islands WITH their client:* directive
│  ├─ <Name>.tsx       island(s)
│  ├─ store.ts         optional station-local state + event handlers
│  └─ <id>.css
├─ <id>.test.ts        renders the shell with the Astro Container API
└─ tsconfig.json, vitest.config.ts
```

Astro requires `client:*` directives on statically imported components, so **hydration directives live inside the station's own `index.astro`**, never in the page that renders it.
The page renders the entry dynamically without a directive.

## Manifest schema

Defined in `@bar/core` as `StationManifestSchema` (Zod, strict: unknown fields are errors).

```ts
type StationManifest = {
  manifestVersion: 1;
  id: string;                     // kebab-case, unique, equal to the folder name
  name: string;                   // human name (wall, nav); 1-40 chars
  blurb?: string;                 // one line under the sleeve; required with a sleeve
  targets: `${string}:${string}`[]; // "page:slot" or "layout:slot"; at least one unless draft
  order?: number;                 // within slot / wall / nav, ascending (ties: id)
  route?: string;                 // if the station owns a page
  sleeve?: { src: string };       // package-relative image (e.g. "./sleeve.svg"); needs route and blurb
  nav?: boolean;                  // default: true when route is set
  draft?: boolean;                // local, sandbox and preview builds only
  hydrate: 'load' | 'idle' | 'visible' | 'none'; // must match index.astro
  listens?: EventType[];          // registered event types; drives per-page subscriptions
};
```

## Entry props

`src/index.astro` receives a `StationContext` (from `@bar/core`) as its props:

```ts
type StationContext = {
  pageId: string;                       // page id, or "layout"
  path: string;                         // current path
  params: Record<string, string | undefined>; // route params, e.g. { slug }
  site: {
    name: string;                       // "[BAR NAME]" until the bar is named
    env: 'local' | 'sandbox' | 'preview' | 'staging' | 'production';
    timeZone: string;
    defaultPhase: Phase;
    nav: { id; name; route }[];         // derived from manifests
    wall: { id; name; blurb; route; sleeveUrl; draft; transitionName }[];
  };
};
```

Stations never import `apps/web`; manifest-derived data (nav, wall) reaches them only through `site`.

## Discovery and validation

`apps/web/src/lib/stations.ts` globs `stations/*/station.ts`, `stations/*/src/index.astro` (component and raw source) and sleeve images (`import.meta.glob`, eager).
Pages are declared in `apps/web/src/page-defs/*.ts`; the layout's slots in `page-defs/layout.ts`.
The build fails, listing every problem at once, on:

- an invalid manifest (any schema rule above);
- a manifest id that differs from its folder, or a duplicate id;
- a target naming an undeclared page or slot;
- `hydrate` mismatching the entry's `client:*` directives, or any `client:only`;
- a missing entry or sleeve file;
- a non-draft route with no page, or whose page the station does not target;
- a draft route colliding with a page, or two stations owning one route.

## Pages and slots

Pages declare slots with `definePage({ id, route, title, tone, slots })` in `page-defs/` and render them with `<SlotOutlet page={page} name="…" />`.
Stations render in a slot sorted by `order`.
A slot with no station renders the outlet's children, or nothing.
`tone: 'paper'` sets `<html data-tone="paper">`.
Draft stations with a route get an automatic "being built" page.

## Rules

- **Static shell first**: complete HTML, reserved dimensions, no layout shift on hydration.
  Live values show a neutral placeholder until the snapshot fills them.
- **Error boundary**: every island wraps its live part in `<StationBoundary station fallback>` from `@bar/room`; the fallback is the static markup.
- **Data**: live data only through `@bar/room` stores, read with `useRoomStore` (hydrates with the server value, then updates).
  Station state derived from events uses `createRoomStore(initial, reducers)` in `store.ts`; list the types in `listens`.
  API reads only through the typed client (`api.request`) in `@bar/room`; `fetch` and `WebSocket` are lint errors in stations.
- **Lifecycle**: `useStationLifecycle({ onEnter, onLeave })` starts and stops ambient work across client-router navigations.
- **Motion**: `useMotion()` gates decorative motion; frame loops use `useTicker` and run only while `useInView`, entered, and moving.
  Entrance motion uses `claimEntrance(name)` (once per session).
  Categories per `docs/frontend.md`.
- **Styling**: role tokens only (see design-system.md); enforced by Stylelint.
- **No cross-imports** between stations; shared components go to `@bar/ui`.
- **Repo content** (projects, roles, profile, menu seed…): read only through `@bar/content` loaders, in the station's `index.astro` at build time.
  Never read files or Astro content collections directly.
  Placeholder content lives in `@bar/content` with bracketed placeholder copy.
