---
name: aws-audit
description: Find AWS resources this project left behind (preview and sandbox stacks, orphaned log groups, buckets) and report what to clean up. Read-only. Use periodically or after closing PRs.
---

Audit the project's AWS footprint in account 441659297085, us-west-2, with the everyday developer profile, used read-only here: `--profile listening-bar --region us-west-2`.
That profile can deploy sandboxes, so this skill relies on its own instructions, not IAM, to stay read-only.
If the sign-in has expired, ask the owner to run `aws sso login --sso-session personal`.

1. **Stacks.** `aws cloudformation describe-stacks` → every `pr-*` and `dev-*` stack with its status.
   A `pr-<n>-*` stack whose PR is closed (`gh pr view <n> --json state`) is a leftover; so is any stack in a failed state.
2. **Log groups.** `aws logs describe-log-groups --log-group-name-prefix /aws/lambda/pr-` and `--log-group-name-prefix pr-` → groups for PRs that are closed.
   Also list log groups without a retention period (`retentionInDays` missing) for `prod-*`, `staging-*` and `/aws/lambda/prod-` or `staging-` prefixes.
3. **Buckets.** `aws s3 ls` → `pr-*` and `dev-*` buckets without a matching stack.
4. **Report** a table (resource, why it is a leftover, rough monthly cost if any) and the exact cleanup commands.
   Do not delete anything: the owner runs cleanup (with `listening-bar-admin` where the everyday role cannot).
   If something keeps leaking, propose the teardown fix (for example in `pr-close.yml`) so it does not recur.
