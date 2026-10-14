---
paths:
  - 'packages/core/src/events/**'
  - 'fixtures/**'
---

# Events

Contract: `docs/contracts/events.md`; guide: `docs/how-to/add-an-event.md`.

- Create event types with `pnpm gen event --type <domain.verb> --domain <domain> --kind state|moment`; each lives in `packages/core/src/events/types/` and is listed in the registry.
- Never publish an unregistered type or bypass validation (`registry.create`, `publish` from `@bar/server`).
- Changing a payload adds a version: versions are contiguous, and every non-latest version needs an upcaster.
  Keep the current and previous version (N-1).
- Changing the envelope, `defineEvent` or the registry machinery is a contract change: ask the owner first.
- Keep fixtures valid for every type: the dev site and visual tests run on them.
