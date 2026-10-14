---
paths:
  - '.github/**'
---

# GitHub Actions

The owner reviews every change here.

- Pin every action to a full commit SHA with the version in a comment; prefer releases at least a week old.
- `actions/checkout` always with `persist-credentials: false`.
- Never interpolate `${{ … }}` into `run:` scripts or `github-script` code; pass values through `env:`.
- Give each job the least `permissions:` it needs; no `pull_request_target` or `workflow_run`.
- Before pushing, run actionlint (with shellcheck) and `zizmor --min-severity medium .github`; CI runs both.
- A PR that changes an agent workflow cannot be reviewed by it until it is on `main` (the action refuses modified workflows).
