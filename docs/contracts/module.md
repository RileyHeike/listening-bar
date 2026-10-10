# Module contract (normative)

A module is one self-contained back-end feature. Modules contain no CDK code;
`infra/` reads their manifests and provisions everything.

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

`ModuleManifestSchema` in `@bar/core`:

```ts
type ModuleManifest = {
  manifestVersion: 1;
  name: string;                        // kebab-case; mounted at /api/<name>
  routes?: string;                     // path to routes.ts
  access?: Record<string, 'public' | 'admin'>; // "GET /path" → level ('admin' mechanism: Open)
  table?: {                            // one table per module
    partitionKey: { name: string; type: 'S' | 'N' };
    sortKey?: { name: string; type: 'S' | 'N' };
    indexes?: { name: string; partitionKey: {...}; sortKey?: {...} }[];
    ttlAttribute?: string;
  };
  emits?: EventType[];                 // must exist in the event registry
  jobs?: { name: string; schedule: string; handler: string }[]; // schedule: "rate(...)" | "cron(...)"
  secrets?: string[];                  // Secrets Manager names (env-prefixed by infra)
  extensions?: { use: string; options?: unknown }[]; // named infra extensions (see below)
};
```

Infra derives from the manifest: table (stateful stack), route mounting,
per-module IAM (its table, its secrets, publish rights for its `emits`
domains), and scheduled Lambdas.

## Lambda grouping

`infra/config/<env>.ts`:

```ts
export default { lambdaGroups: { api: ['*'] } }; // start consolidated
```

Moving a module into its own group requires no module code change.

## Infra extensions

For resources outside the manifest vocabulary (e.g. a queue, a bucket
trigger), add a named extension once in `infra/extensions/<name>.ts`:

```ts
export default defineExtension({
  name: 'queue',
  optionsSchema: z.object({ ... }),   // validates manifest options
  apply(scope, module, options, ctx) { /* create resources, grant module access, expose env vars */ },
});
```

Modules reference it with `extensions: [{ use: 'queue', options: {...} }]`.
Adding an extension is an infrastructure change and needs owner approval;
using an existing one does not.

## Rules

- Modules never import other modules.
- Publish only via `publish()` from `@bar/server`.
- Read secrets only via the cached `getSecret()` helper.
- Log via the shared logger (structured, includes event ids).
- Every route validates input with Zod.
