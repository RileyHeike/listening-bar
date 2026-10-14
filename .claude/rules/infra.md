---
paths:
  - 'infra/**'
---

# Infrastructure

Guide: `docs/infrastructure.md`.
The owner reviews every change here.

- Every stack and resource is named with the environment prefix (`prod`, `staging`, `pr-<n>`, `dev-<user>`) and tagged `env`, `prefix` and `project`; IAM for previews relies on the `pr-*` names and the `env` tag.
- Design the teardown with the resource: anything created for a preview or sandbox must disappear when it is destroyed, including what CloudFormation does not own (run-time log groups, uploaded objects).
- Least privilege: scope IAM to named resources; a wildcard needs a reason in a comment and a CDK assertion test.
- Never deploy or destroy production, staging or the account stacks; only `pnpm sandbox:*` for your own sandbox.
  Show the owner a `cdk diff` for account-level changes; the owner deploys them.
- Production stateful resources keep RETAIN, PITR, deletion and termination protection.
