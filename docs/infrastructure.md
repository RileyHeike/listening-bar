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
| `cdk deploy --all -c env=preview -c pr=<n>` (add `-c siteDist=<path>` until there is a domain) | `pr-<n>-stateful`, `pr-<n>-stateless` (with its own CloudFront site until there is a domain) |
| `pnpm sandbox:deploy` (`-c env=sandbox -c user=<name>`) | `dev-<user>-*` (no CloudFront) |
| `cdk deploy --all -c env=account` | `account-access` (developer role, budget); `account-preview-certificate`, `account-preview-site` once a domain is set; `account-ci-access` once a repository is set |

Every stack is pinned to the project account (`project.account`); synth refuses credentials for any other account.
CDK is bootstrapped in us-west-2 (shared with other projects in the account) and us-east-1.

## Access (personal account)

- Sign in with IAM Identity Center: `aws sso login --sso-session personal` (one sign-in shared by all personal projects in the account).
  Do not use the root user for day-to-day work.
- `listening-bar-admin` profile: Identity Center `AdministratorAccess`; only for one-time setup (bootstrap, account stacks).
- `listening-bar` profile: the `listening-bar-developer` role, entered from that sign-in.
  It can only deploy through the CDK bootstrap roles and read stacks and logs; the sandbox scripts use it automatically.
- Budget: `listening-bar-monthly`, $5/month for resources tagged `project=listening-bar` (a cost allocation tag), emailed at 80% actual and 100% forecast spend.
  The account is shared with other projects, so the budget filters by tag rather than counting the whole account.

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

Every pull request from this repository (not forks or Dependabot) gets a full preview: its own `pr-<n>` stateful and stateless stacks, seeded with fixture events, then verified with Playwright, the integration tests and Lighthouse.
The preview URL is commented on the PR.

- **Until the domain exists:** `pr-<n>-stateless` also owns a CloudFront site, exactly like staging (same-origin `/api`, `config.json` written by the stack), on its default `*.cloudfront.net` domain.
  CloudFront distributions take several minutes to create and delete, so the first preview deploy and the teardown are the slow steps.
- **Once the domain exists:** one long-lived PreviewSite stack holds an S3 bucket with `/pr-<n>/` prefixes, one CloudFront distribution on `*.preview.<domain>`, and a CloudFront Function mapping host `pr-<n>.preview…` to the prefix.
  Each PR uploads its build to its prefix, including a `/config.json` with that PR's API and AppSync endpoints.
  Switching needs no workflow change: the workflows read the repository variable `BAR_DOMAIN`.
- On PR close (`pr-close.yml`): delete the prefix (if any), destroy the `pr-<n>` stacks, then delete the `/aws/lambda/pr-<n>-*` log groups that CDK's helper functions (bucket auto-delete, site upload) create at run time and the stacks therefore do not own.
  Nothing billable is left behind.

## CI access

`account-ci-access` (created once `project.github` is set) holds the account's GitHub OIDC provider (`AWS::IAM::OIDCProvider`; one per account, so other projects' roles should trust it rather than create another) and these roles:

- `bar-ci-release`: trusted only for jobs in the `staging` and `production` GitHub Environments (deployable from `main` only; production needs approval); may assume the CDK bootstrap roles.
  Not trusted for every job on `main`: issue-triggered agent jobs run there too.
  Exists before there is a domain, so staging and production deploy without one.
- `bar-ci-preview`: trusted for pull requests only; may manage CloudFormation stacks named `pr-*`, read their Lambda logs, delete leftover `/aws/lambda/pr-*` log groups, pass the execution role `bar-ci-preview-exec`, and (once the domain exists) upload to the shared preview bucket under `pr-*`.
- `bar-ci-preview-exec`: the CloudFormation execution role for preview stacks (they use the CLI-credentials synthesizer and deploy with `--role-arn`).
  It may manage `pr-*` named resources (tables, functions, log groups, schedules, topics, roles, buckets, CloudFront functions) and the services whose resources have generated ids (AppSync, API Gateway, CloudFront distributions).
- Both preview roles explicitly deny every action on resources tagged `env=production`, `env=staging`, `env=sandbox` or `env=account`, so a pull request can never change another environment even through a generated-id service.

If a preview deploy is denied, find the action in CloudTrail and widen the exec role by exactly that action, scoped to `pr-*` where the service allows it.

Trust uses GitHub's immutable OIDC subjects, `repo:<owner>@<owner id>/<name>@<repo id>:…` (`project.github` holds the ids).
A renamed or re-created repository with the same name cannot assume the roles.

GitHub configuration (repository `RileyHeike/listening-bar`):

- Merge settings, the `main` ruleset (required checks, squash only, admin bypass only through a PR), CodeQL and Dependabot security updates are applied by `tools/repo/lock-in.sh` (owner runs it; safe to re-run).

- Environments `staging` and `production`, deployable from `main` only; `production` requires RileyHeike's approval.
- Repository variable `AWS_ACCOUNT_ID=441659297085`.
- Actions may create pull requests (release-please).
- Dependabot proposes grouped minor and patch updates only, with a 7-day cooldown; majors are upgraded deliberately.

## Pipelines (GitHub Actions, OIDC)

| Workflow | Trigger | Steps |
|---|---|---|
| `checks.yml` | reused | format, typecheck, lint, unit + CDK assertion tests, production-build check, Playwright on a local build |
| `pr.yml` | PR open/sync | checks, PR title, workflow lint (actionlint + zizmor), generator smoke test when generator inputs change → deploy `pr-<n>` → seed fixtures → Playwright, integration tests, Lighthouse (warn) → comment preview URL; on agents' PRs, a failure starts a fix attempt |
| `pr-close.yml` | PR closed | tear down preview |
| `main.yml` | push to main | checks → deploy staging + smoke E2E → manual approval (GitHub Environment) → deploy prod + smoke |
| `visual.yml` | push to main, PR | screenshot every page; on PRs compare with `main`, comment, and label big changes `needs-design-review` |
| `agent-review.yml` | PR open/sync | Claude reviews against the rules and contracts (required `agent-review`); agents' PRs fix requested changes |
| `owner-gate.yml` | PR events, reviews | required `owner-gate`: owner sign-off for owned paths and `needs-*` labels |
| `agent.yml` | issue labelled `agent`; `@claude` comments | Claude implements the issue and opens a PR; answers or edits on request |
| `release.yml` | push to main | release-please release PR / tags |

Deploy jobs run only when the repository variable `AWS_ACCOUNT_ID` is set; once there is a domain, previews also read `BAR_DOMAIN`, `PREVIEW_BUCKET` and `PREVIEW_DISTRIBUTION_ID` (outputs of the account stacks).
Actions are pinned to commit SHAs; Dependabot proposes updates.
Required reviewers on GitHub Environments may need a paid plan for private repos.

## Domain

Register via Route 53 once the bar is named (open decision), then set `domain` in `infra/config/project.ts`.
Until then, production and staging deploy on CloudFront default domains.
