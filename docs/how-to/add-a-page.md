# Add a page

Pages declare slots; stations fill them.

## 1. Generate it

```sh
pnpm gen page --id tea-room --route /tea-room --slots intro,shelf
```

This creates:

- `apps/web/src/page-defs/tea-room.ts`: `definePage({ id, route, title, tone, slots })`.
- `apps/web/src/pages/tea-room.astro`: the page, with one `SlotOutlet` per slot.

Routes with parameters (`/notes/[slug]`) get an empty `getStaticPaths` to fill in, usually from a `@bar/content` loader.

## 2. Arrange the slots

The page owns layout: give `SlotOutlet`s a `class` and arrange them with the page's scoped styles.
Set `tone: 'paper'` in the page definition for a daylight reading room (ignores the lighting phase).
A `SlotOutlet` can have children; they render when no station fills the slot.

## 3. Fill it

Target the slots from stations (`--target tea-room:intro`).
The build fails, listing every problem, if a station targets a page or slot that does not exist.
