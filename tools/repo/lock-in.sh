#!/usr/bin/env bash
# One-time GitHub settings for the autonomous-agent workflow (docs/agents.md).
# Run by the owner (needs admin on the repository): tools/repo/lock-in.sh
# Safe to re-run: settings are set, the label and ruleset are created or updated.
set -euo pipefail

REPO=RileyHeike/listening-bar

echo "Merge settings: squash only, PR title as the commit, auto-merge, delete merged branches"
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK >/dev/null

echo "Label: owner-approved"
gh api "repos/$REPO/labels/owner-approved" >/dev/null 2>&1 ||
  gh api "repos/$REPO/labels" -f name=owner-approved -f color=0e8a16 \
    -f description="The owner signed off (only the owner adds this)" >/dev/null

echo "Security: Dependabot security updates, CodeQL default setup"
gh api -X PUT "repos/$REPO/automated-security-fixes" >/dev/null
gh api -X PATCH "repos/$REPO/code-scanning/default-setup" --input - >/dev/null <<'JSON'
{ "state": "configured", "languages": ["javascript-typescript", "actions"], "query_suite": "default" }
JSON

echo "Ruleset on main: PRs only, squash only, required checks; the owner may merge past checks but never push directly"
ruleset=$(cat <<JSON
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "checks / checks", "integration_id": 15368 },
          { "context": "pr-title", "integration_id": 15368 },
          { "context": "workflow-lint", "integration_id": 15368 },
          { "context": "generators", "integration_id": 15368 },
          { "context": "preview", "integration_id": 15368 },
          { "context": "capture", "integration_id": 15368 },
          { "context": "agent-review", "integration_id": 15368 },
          { "context": "owner-gate", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
)
existing=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name == "main") | .id')
if [ -n "$existing" ]; then
  gh api -X PUT "repos/$REPO/rulesets/$existing" --input - >/dev/null <<<"$ruleset"
else
  gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null <<<"$ruleset"
fi

echo "Done."
