# Infrastructure (AWS CDK)

## App structure

```
infra/
├─ bin/app.ts             reads env name, loads config, discovers modules (glob modules/*/module.ts), builds stacks
├─ config/{prod,staging,preview,sandbox}.ts
├─ stacks/
│  ├─ certificate.ts      us-east-1: apex/www + *.preview.<domain>
│  ├─ stateful.ts         module tables, room-state, media bucket
│  ├─ stateless.ts        Lambdas, HTTP API, AppSync Events API, CloudFront, site bucket, scheduler, image processor
│  └─ preview-site.ts     shared preview distribution + bucket + routing function (deployed once)
├─ constructs/            ModuleConstruct (manifest → resources), SiteConstruct, RealtimeConstruct…
└─ extensions/            named resource plugins referenced from module manifests
```

Modules contain no CDK. `ModuleConstruct` maps a validated manifest to:
table, route mounting, IAM (least privilege for its group), schedules,
secret access, AppSync publish rights for its domains.

## Naming and safeguards

- Stack and resource names prefixed `<env>-` (`prod`, `staging`, `pr-<n>`,
  `dev-<user>`), all tagged `env`, `project`.
- CI preview role can only act on `pr-*` resources.
- Production stateful resources: RETAIN, PITR, termination protection.
- AWS Budgets alert on the account.

## Cross-stack references

Stateless receives Stateful's resources as constructor props; CDK generates
CloudFormation exports automatically. Exports cannot change while imported, so
removing or renaming a module's table is a two-step deploy: (1) remove the
consumer (and, if needed, pin the export with `exportValue`), deploy;
(2) remove the resource, deploy. Document each such change in the PR.

## Infra extensions

`infra/extensions/*` are named plugins (see contracts/module.md) applied by
`ModuleConstruct` when a manifest references them. Each extension has CDK
assertion tests.

## Previews

- One long-lived PreviewSite stack: S3 bucket with `/pr-<n>/` prefixes, one
  CloudFront distribution on `*.preview.<domain>`, a CloudFront Function
  mapping host `pr-<n>.preview…` → prefix.
- Each PR deploys its own `pr-<n>` stateful + stateless backend stacks
  (no CloudFront in them) and uploads its build to its prefix, including a
  `/config.json` with that PR's API and AppSync endpoints.
- On PR close: delete prefix, destroy `pr-<n>` stacks.

## Pipelines (GitHub Actions, OIDC)

| Workflow | Trigger | Steps |
|---|---|---|
| `pr.yml` | PR open/sync | typecheck, lint, unit + CDK assertion tests → deploy `pr-<n>` → integration tests, Playwright, Lighthouse (warn) → comment preview URL |
| `pr-close.yml` | PR closed | tear down preview |
| `main.yml` | push to main | deploy staging → smoke E2E → manual approval (GitHub Environment) → deploy prod → smoke check |
| `release.yml` | push to main | release-please release PR / tags |
| `generators.yml` | PR touching tools/ | run each generator into scratch, build + test |

Note: required reviewers on GitHub Environments may need a paid plan for
private repos.

## Domain

Register via Route 53 once the bar is named (Open). Until then, deploy on
CloudFront default domains; keep domain wiring behind config.
