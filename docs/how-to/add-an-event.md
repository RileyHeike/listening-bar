# Add an event

Events carry live data from modules to stations.
Read `docs/contracts/events.md` first.

## 1. Generate it

```sh
pnpm gen event --type plant.watered --domain plants --kind state
```

- `--type` is `subject.pastTenseVerb`.
- `--domain` is the real-time channel namespace; stations on a page subscribe per domain.
- `--kind` is `state` (latest value, kept in the snapshot) or `moment` (fire and forget).

This creates the definition in `packages/core/src/events/types/`, registers it in `registry.ts`, adds fixtures in `fixtures/src/events/` and a test.
A new domain also gets its own AppSync channel namespace on the next deploy.

## 2. Describe the data

Replace the placeholder v1 schema and fixtures.
Fixtures must validate; a missing fixture entry is a compile error.

## 3. Change it later

Never edit a published version's schema.
Add version 2 alongside version 1, with an upcaster from 1 to 2; the runtime upcasts everything it receives, so stations only see the latest shape.
Keep the previous version (N-1) until no `room-state` item still holds it.
