# Event contract (normative)

## Envelope

```ts
type Envelope<T extends EventType> = {
  id: string;          // ULID
  type: T;             // "domain.pastTenseVerb", e.g. "track.changed"
  v: number;           // schema version of `data`
  at: string;          // ISO-8601 UTC
  source: string;      // module name, or "control-panel"
  data: EventData<T>;
};
```

## Registry

All event types are registered in `@bar/core/events/registry.ts`:

```ts
defineEvent({
  type: 'track.changed',
  domain: 'music',               // → AppSync channel namespace
  kind: 'state',                 // 'state' (latest wins, in snapshot) | 'moment'
  versions: { 1: z.object({...}), 2: z.object({...}) },
  upcast: { 1: (d) => ({ ...d, newField: null }) }, // vN → vN+1
});
```

- Publishing an unregistered type or invalid data throws.
- The runtime upcasts every received envelope (live and snapshot) to the
  latest version before dispatch; stations only see the latest shape.
- Support window: current and previous version (N-1). Removing an older
  version requires that no `room-state` item still holds it.

## Delivery

- Server: `publish()` validates, writes state events to `room-state`
  (PK = type), then HTTP-publishes to AppSync namespace `/<domain>`.
- Client: transport subscribes per domain needed on the page; on every
  (re)connect, re-fetch `/api/room/snapshot` first. Moment events missed while
  disconnected are not replayed.

## Transport adapter

```ts
interface Transport {
  subscribe(domain: string, onEnvelope: (e: unknown) => void): () => void;
  status: ReadableAtom<'connecting' | 'open' | 'offline'>;
}
```

Implementations: `appsync` (production/preview/staging/sandbox), `local`
(in-browser bus used by the control panel's local mode). Feature code never
references an implementation directly.

## Foundation event set

Only what placeholder stations and the control panel need, e.g.
`track.changed`, `track.stopped`, `weather.changed`, `menu.updated`. Each has
fixtures. Add new types with `pnpm gen event`.
