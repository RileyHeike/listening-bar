# Event contract (normative)

## Envelope

```ts
type Envelope<T extends EventType> = {
  id: string;          // ULID (sorts by creation time)
  type: T;             // "subject.pastTenseVerb", e.g. "track.changed"
  v: number;           // schema version of `data`
  at: string;          // ISO-8601 UTC
  source: string;      // module name, "control-panel", or "fixtures"
  data: EventData<T>;  // latest version's shape
};
```

`Envelope` alone is the union over every registered type, discriminated on `type`.

## Registry

Each event type lives in `packages/core/src/events/types/<type>.ts` and is listed in `packages/core/src/events/registry.ts`:

```ts
export const trackChanged = defineEvent({
  type: 'track.changed',
  domain: 'music',               // → AppSync channel namespace
  kind: 'state',                 // 'state' (latest wins, in snapshot) | 'moment'
  description: 'A new track started playing on the hi-fi.',
  versions: { 1: z.object({...}), 2: z.object({...}) },
  upcast: { 1: (d) => ({ ...d, newField: null }) }, // vN → vN+1
});
```

- Versions are contiguous integers; every non-latest version needs an upcaster (checked when the module loads).
- `registry.create(type, data, { source })` builds a validated latest-version envelope; an unregistered type or invalid data throws.
- `registry.receive(raw)` validates an envelope from the wire and upcasts it to the latest version; it never throws.
  The runtime runs every received envelope (live and snapshot) through it, so stations only see the latest shape.
- Support window: current and previous version (N-1).
  Removing an older version requires that no `room-state` item still holds it.

## Delivery

- Server: `publish(type, data, { source })` from `@bar/server` validates, writes state events to `room-state` (PK = type), then publishes over HTTP (IAM-signed) to the AppSync channel `/<domain>/room`.
- Client: the runtime subscribes to the domains needed by the stations on the current page (layout `<meta name="bar:domains">`, from manifests' `listens`).
  On every (re)connect it re-fetches `/api/room/snapshot` first.
  Moment events missed while disconnected are not replayed.
- Ordering: the runtime keeps the latest state envelope per type and drops older ones.
  `createRoomStore` recomputes from the latest envelope of each of its types when an older state event arrives late, so latest wins across types too.

## Transport adapter

```ts
interface Transport {
  subscribe(domain: string, onEnvelope: (e: unknown) => void): () => void;
  status: ReadableAtom<'connecting' | 'open' | 'offline'>;
}
```

Implementations: `appsync` (`createAppSyncTransport`: production, staging, previews, sandbox) and `local` (in-browser bus with BroadcastChannel, used by the control panel's local mode).
Feature code never references an implementation directly.

## Foundation event set

| Type | Domain | Kind | Used by |
|---|---|---|---|
| `track.changed` | music | state | hi-fi |
| `track.stopped` | music | state | hi-fi |
| `spins.updated` | music | state | hi-fi ("Recently spun") |
| `weather.changed` | weather | state | window |
| `menu.updated` | menu | state | chalkboard |

Each has fixtures in `fixtures/src/events/`.
Add new types with `pnpm gen event` (see `docs/how-to/add-an-event.md`).
