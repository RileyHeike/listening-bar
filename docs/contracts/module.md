# Module contract (normative)

A module is one self-contained back-end feature.
Modules contain no CDK code; `infra/` reads their manifests and provisions everything.
Create modules with `pnpm gen module` (see `docs/how-to/add-a-module.md`).

## Package layout

```
modules/<name>/
├─ package.json        "@bar/module-<name>"; deps: @bar/server, @bar/core
├─ module.ts           default export: defineModule({...})
├─ src/
│  ├─ routes.ts        export default (app: Hono) => void
│  ├─ entities.ts      DynamoDB Toolbox Table + Entity definitions
│  └─ jobs/<job>.ts    export const handler
└─ <name>.test.ts
```

## Manifest schema

`ModuleManifestSchema` in `@bar/core` (strict: unknown fields are errors):

```ts
type ModuleManifest = {
  manifestVersion: 1;
  name: string;                        // kebab-case, equal to the folder; mounted at /api/<name>; "room" is reserved
  routes?: './src/routes.ts';
  access?: Record<string, 'public' | 'admin'>; // "GET /path" → level ('admin' mechanism: Open); needs routes
  table?: {                            // one table per module, named "<env prefix>-<name>"
    partitionKey: { name: string; type: 'S' | 'N' };
    sortKey?: { name: string; type: 'S' | 'N' };
    indexes?: { name: string; partitionKey: {...}; sortKey?: {...} }[]; // global secondary indexes
    ttlAttribute?: string;
  };
  emits?: EventType[];                 // must exist in the event registry
  jobs?: { name: string; schedule: string; handler: './src/jobs/<job>.ts' }[]; // "rate(...)" | "cron(...)"
  secrets?: string[];                  // Secrets Manager names, read as "<env prefix>/<name>"
  extensions?: { use: string; options?: unknown }[]; // named infra extensions (see below)
};
```

Infra derives from the manifest:

- the table (Stateful stack; RETAIN and PITR in production);
- route mounting (`/api/<name>` and `/api/<name>/{proxy+}`) on the module's Lambda group;
- least-privilege IAM for that group: its table, its secrets, AppSync publish on its `emits` domains' namespaces, and `room-state` writes when it emits state events;
- one Lambda and one EventBridge Scheduler schedule per job, with the same grants;
- environment: `BAR_TABLE_<NAME>` (table name), `SECRETS_PREFIX`, `ROOM_STATE_TABLE`, `REALTIME_HTTP_HOST`, `BAR_ENV`.

## Lambda grouping

`infra/config/<env>.ts`:

```ts
export default { lambdaGroups: { api: ['*'] }, ... }; // start consolidated
```

`"*"` collects every module not listed elsewhere.
Platform routes (`/api/room/...` and the catch-all 404) go to the group listing `"room"`, else the `"*"` group.
Moving a module into its own group requires no module code change.

## Infra extensions

For resources outside the manifest vocabulary (e.g. a queue, a bucket trigger), add a named extension once in `infra/extensions/<name>.ts`:

```ts
export default defineExtension({
  name: 'queue',
  optionsSchema: z.object({ ... }),   // validates manifest options at synth
  apply(scope, module, options, ctx) {
    // ctx: { prefix, fn (the module's Lambda), table, addEnvironment(name, value) }
  },
});
```

Modules reference it with `extensions: [{ use: 'queue', options: {...} }]`.
An unknown extension or invalid options fail the synth with a clear message.
Adding an extension is an infrastructure change and needs owner approval; using an existing one does not.

## Rules

- Modules never import other modules.
- Publish only via `publish(type, data, { source })` from `@bar/server`.
- Read secrets only via the cached `getSecret(name)` helper.
- Log via the shared `logger` (structured; add `withEnvelope(envelope)` for event correlation).
- Every route validates input with Zod (`validate` / `readJson` from `@bar/server`).
- Errors are `{ error: { code, message } }`; throw `ApiError(status, code, message)` for expected failures.
