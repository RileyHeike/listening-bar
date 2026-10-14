---
paths:
  - 'modules/**'
  - 'packages/server/**'
---

# Modules and the server

Contract: `docs/contracts/module.md`; guides: `docs/backend.md`, `docs/how-to/add-a-module.md`.

- Create modules with `pnpm gen module --name <name>`; modules contain no CDK (infra comes from the manifest).
- A module never imports another module.
- Every route validates input with Zod (`validate` / `readJson` from `@bar/server`); errors are `{ error: { code, message } }` via `ApiError`.
- Publish only with `publish(type, data, { source })`; read secrets only with `getSecret(name)`; log with the shared `logger`.
- Write routes need admin authentication, which is an open decision: ask the owner before adding one.
