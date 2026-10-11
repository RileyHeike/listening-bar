# Add a module

A module is a back-end feature: routes, data, jobs, events.
Modules contain no infrastructure code; `infra/` reads their manifests.
Read `docs/contracts/module.md` first.

## 1. Generate it

```sh
pnpm gen module --name plant-care
```

This creates `modules/plant-care/` with a manifest, an example route at `GET /api/plant-care/hello`, DynamoDB Toolbox entities, and a test that mounts the routes through `@bar/server`'s `buildApp`.

## 2. Describe what it needs

Edit `module.ts`: routes and their access levels, the table's keys and indexes, events it emits, scheduled jobs, secrets, and named infra extensions.
Infra provisions exactly that, with least-privilege IAM.
Write routes need the admin authentication mechanism, which is still an open decision.

## 3. Write the code

- Routes: `export default (app: Hono) => void`; validate every input with `validate` or `readJson` from `@bar/server`.
- Data: entities in `src/entities.ts`; the table name is in `BAR_TABLE_<NAME>`.
- Events: publish only with `publish(type, data, { source })`.
- Secrets: `getSecret(name)` reads `<env prefix>/<name>`.
- Jobs: `src/jobs/<job>.ts` exporting `handler`.

## 4. Try it

Deploy your sandbox with `pnpm sandbox:deploy`, then `pnpm dev`; the dev server proxies `/api` to it.
`pnpm sandbox:watch` hotswaps Lambda code as you edit.
