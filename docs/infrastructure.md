# Infrastructure (AWS CDK)

## App structure

```
infra/
├─ bin/app.ts             reads -c env, loads config, discovers modules (modules/*/module.ts) and extensions, builds stacks
├─ config/
│  ├─ project.ts          region, domain (open decision), GitHub repo, alert email, budget
│  └─ {production,staging,preview,sandbox}.ts   per-environment settings and Lambda groups
├─ lib/                   app assembly, naming, module discovery, entry generation, bundling, defineExtension
├─ stacks/
│  ├─ certificate.ts      us-east-1 certificates (only once a domain is set)
│  ├─ stateful.ts         room-state, module tables, media bucket, budget alert (production)
│  ├─ stateless.ts        Lambdas, HTTP API, AppSync Events, CloudFront site, schedules, alarms
│  ├─ preview-site.ts     shared preview distribution + bucket + routing function (account-level)
│  └─ ci-access.ts        GitHub OIDC roles for CI (account-level)
├─ constructs/            Api, ModuleConstruct, Realtime, Site
├─ extensions/            named resource plugins referenced from module manifests
└─ scripts/               sandbox.ts (deploy/watch/destroy), ci-outputs.ts
```

Modules contain no CDK.
`ModuleConstruct` maps a validated manifest to table access, routes, IAM (least privilege for its group), schedules, secret access, AppSync publish rights for its domains, and extensions.

## Targets

| Command | Stacks |
|---|---|
| `cdk deploy --all -c env=production` (add `-c siteDist=<path>`) | `prod-stateful`, `prod-stateless` (+ `prod-certificate` once a domain is set) |
| `cdk deploy --all -c env=staging` | `staging-*` |
| `cdk deploy --all -c env=preview -c pr=<n>` | `pr-<n>-stateful`, `pr-<n>-stateless` (no CloudFront) |
| `pnpm sandbox:deploy` (`-c env=sandbox -c user=<name>`) | `dev-<user>-*` (no CloudFront) |
| `cdk deploy --all -c env=account` | `account-access` (developer role, budget); `account-preview-certificate`, `account-preview-site` once a domain is set; `account-ci-access` once a repository is set |

Every stack is pinned to the project account (`project.account`); synth refuses credentials for any other account.
CDK is bootstrapped in us-west-2 (shared with other projects in the account) and us-east-1.

## Access (personal account)

- Sign in with IAM Identity Center: `aws sso login --sso-session league-site` (the same session as league-site).
  Do not use the root user for day-to-day work.
- `listening-bar-admin` profile: Identity Center `AdministratorAccess`; only for one-time setup (bootstrap, account stacks).
- `listening-bar` profile: the `listening-bar-developer` role, entered from that sign-in.
  It can only deploy through the CDK bootstrap roles and read stacks and logs; the sandbox scripts use it automatically.
- Budget: `listening-bar-monthly`, $5/month, emailed at 80% actual and 100% forecast spend.

## Naming and safeguards

- Stack and resource names prefixed `<env>-` (`prod`, `staging`, `pr-<n>`, `dev-<user>`); everything tagged `env`, `prefix` and `project`.
- CI preview role can only act on `pr-*` resources (see below).
- Production stateful resources: RETAIN, PITR, deletion protection, termination protection.
- AWS Budgets alert in `account-access` ($5/month to `alertEmail`).
- Feature flags: CDK's recommended set, with cross-stack references pinned to `strong` (CloudFormation exports, per decisions.md).

## Cross-stack references

Stateless receives Stateful's resources as constructor props; CDK generates CloudFormation exports automatically.
Exports cannot change while imported, so removing or renaming a module's table is a two-step deploy: (1) remove the consumer (and, if needed, pin the export with `exportValue`), deploy; (2) remove the resource, deploy.
Document each such change in the PR.

## Infra extensions

`infra/extensions/*` are named plugins (see contracts/module.md) applied by `ModuleConstruct` when a manifest references them.
Each extension has CDK assertion tests.

## Previews

- One long-lived PreviewSite stack: S3 bucket with `/pr-<n>/` prefixes, one CloudFront distribution on `*.preview.<domain>`, and a CloudFront Function mapping host `pr-<n>.preview…` to the prefix.
  It needs the bar's domain (an open decision); until then the account target skips it and PR workflows skip previews.
- Each PR deploys its own `pr-<n>` stateful + stateless stacks and uploads its build to its prefix, including a `/config.json` with that PR's API and AppSync endpoints.
- On PR close: delete the prefix, destroy the `pr-<n>` stacks.

## CI access

`account-ci-access` creates the GitHub OIDC provider and two roles:

- `bar-ci-release`: trusted for `main` and the `staging` and `production` GitHub Environments; may assume the CDK bootstrap roles.
- `bar-ci-preview`: trusted for pull requests only; may manage CloudFormation stacks named `pr-*`, upload to the preview bucket under `pr-*`, and pass the execution role `bar-ci-preview-exec`.
  Preview stacks use the CLI-credentials synthesizer and deploy with `--role-arn bar-ci-preview-exec`, whose permissions are limited to `pr-*` named resources and resources tagged `env=preview`.
  Validate these policies in the real account when first enabling previews; widen only what CloudFormation proves it needs.

## Pipelines (GitHub Actions, OIDC)

| Workflow | Trigger | Steps |
|---|---|---|
| `checks.yml` | reused | format, typecheck, lint, unit + CDK assertion tests, production-build check, Playwright on a local build |
| `pr.yml` | PR open/sync | checks → deploy `pr-<n>` → upload preview → integration tests, Playwright, Lighthouse (warn) → comment preview URL |
| `pr-close.yml` | PR closed | tear down preview |
| `main.yml` | push to main | checks → deploy staging + smoke E2E → manual approval (GitHub Environment) → deploy prod + smoke |
| `release.yml` | push to main | release-please release PR / tags |
| `generators.yml` | PR touching generators, events, pages, infra | run every generator and check the output (`tools/generators/smoke.sh`) |

Deploy jobs run only when the repository variable `AWS_ACCOUNT_ID` is set; previews also need `BAR_DOMAIN`, `PREVIEW_BUCKET` and `PREVIEW_DISTRIBUTION_ID` (outputs of the account stacks).
Actions are pinned to commit SHAs; Dependabot proposes updates.
Required reviewers on GitHub Environments may need a paid plan for private repos.

## Domain

Register via Route 53 once the bar is named (open decision), then set `domain` in `infra/config/project.ts`.
Until then, production and staging deploy on CloudFront default domains.
