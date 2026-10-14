# Autonomous agent workflow

Agents implement, verify, evaluate, review and merge work on their own.
The owner is asked only about architecture decisions and design vision.

## The loop

1. **Intake.** Work starts as an issue (the "Task" form), written so it can be finished without questions: goal, acceptance criteria, out of scope.
   The owner labels it `agent` to hand it over (only people with write access can label, and the issue text becomes the agent's prompt, so read it first).
2. **Implement** (`agent.yml`, job `implement`). Claude reads the issue, branches `claude/issue-<n>-<slug>` from `main`, implements with the generators and `docs/how-to/`, verifies with `pnpm typecheck && pnpm lint && pnpm test` (and `pnpm test:e2e` for anything visible), and opens a PR with auto-merge enabled.
   If the issue needs a decision, it asks on the issue instead and labels it `needs-owner`.
3. **Verify.** Every push to a PR runs:

   | Check | What it proves |
   |---|---|
   | `checks` | format, typecheck, lint, unit/contract/CDK tests, production-build exclusions, Playwright on a local build |
   | `pr-title` | the title is a Conventional Commit (it becomes the squash commit) |
   | `workflow-lint` | workflows pass actionlint and the zizmor security audit |
   | `generators` | when generator inputs changed, every generator's output still passes every check |
   | `preview` | the PR's own `pr-<n>` stacks deploy; Playwright, integration tests and Lighthouse pass against them |
   | `capture` | screenshots of every page, compared with `main` (see below) |
   | `agent-review` | Claude's review approves (see below) |
   | `owner-gate` | the owner has signed off, when the PR needs it (see below) |

4. **Fix.** On agents' PRs, failures fix themselves: when a check fails or the review requests changes, Claude reads the logs or findings, fixes the cause, verifies, and pushes.
   At most three attempts per PR (each is announced in a PR comment), then the PR is labelled `needs-owner`.
5. **Merge.** Once every required check passes, auto-merge squashes the PR into `main`, which deploys staging; production still waits for the owner's approval.

Anyone with write access can also comment `@claude …` on an issue or PR (`agent.yml`, job `respond`) to ask a question or have a change made on that PR's branch.

## Agent review

`agent-review.yml` runs Claude on every non-draft PR (except Dependabot's) with `.claude/agents/reviewer.md` as its guide: the golden rules, contracts, decisions, front-end rules, correctness, and the visual comparison.
It posts one summary comment (updated on each push), inline comments for blocking findings, and a verdict:

| Verdict | Effect |
|---|---|
| `approve` | the check passes |
| `request_changes` | the check fails; on `claude/*` branches Claude fixes the findings |
| `needs_owner` | the check fails and the PR is labelled `needs-owner`, with the question in the comment |

PRs from forks fail the check: the owner reviews outside contributions.
Locally, the same guide is the `reviewer` subagent: ask for a review by the reviewer agent before opening a PR.
On PRs, `.claude/` comes from the base branch, so a PR cannot change the rules it is reviewed by.

## When the owner is asked

`owner-gate.yml` (logic and tests in `tools/ci/owner-gate.ts`) holds a PR when:

- it touches an **owner-reviewed path** (`.github/CODEOWNERS`): decisions, contracts, the agent rules, design tokens, infrastructure, CI and repo tooling;
- it is labelled `needs-design-review` (a big visual change); or
- it is labelled `needs-owner` (a question only the owner can answer).

The owner signs off by approving the PR on its latest commit, or, for PRs opened under the owner's own account (which GitHub does not let them approve), by adding the `owner-approved` label after the latest push.
A new push needs a new sign-off.
`needs-owner` holds until the owner answers and removes the label.
The gate runs from the base branch, so a PR cannot change the rules it is judged by.

An agent that needs a decision that is Open, Parked or not covered in `docs/decisions.md` asks in a comment (options and trade-offs), labels the PR or issue `needs-owner`, and stops.

## Visual changes

`visual.yml` screenshots every page in both lighting modes, and the room in every lighting phase, on desktop and phone.
The clock is fixed and motion reduced, so the same code always produces the same pixels.
Each push to `main` keeps its screenshots as the baseline; each PR is compared with it and gets a comment listing what changed.

- **Unchanged** (under 0.05% of pixels): nothing to do.
- **Small** (under 2%): the AI reviewer judges whether the change is intended, using the diff images.
- **Big** (2% or more, or a screenshot that disappeared): the PR is labelled `needs-design-review` and waits for the owner.

To look at the screenshots locally: `pnpm --filter @bar/web test:visual` writes them to `apps/web/visual-results/current/`.
Thresholds are in `apps/web/visual/compare.ts`.

## Labels

| Label | Meaning |
|---|---|
| `agent` | an agent should implement this issue |
| `needs-owner` | waiting on an owner decision; agents stop, fixes stop |
| `needs-design-review` | the change alters the look beyond the visual threshold; waiting on the owner |
| `owner-approved` | the owner signed off (for PRs under the owner's own account); only the owner adds it |

## Parallel work

- In GitHub, each issue gets its own job and branch; any number run at once.
- Locally, run parallel agents in separate git worktrees (`git worktree add ../bar-<task> -b <type>/<task>`), each with its own sandbox: `BAR_SANDBOX_USER=<name> pnpm sandbox:deploy`.
  The dev server picks the next free port.

## Guardrails

- `.claude/settings.json` pre-approves the everyday commands and denies pushing to `main`, force-pushing, approving or admin-merging PRs, adding `owner-approved`, removing `needs-*` labels, and deploying or destroying shared environments.
- In GitHub, Claude runs with an explicit tool allowlist per job; it can push only its own branch, and only the deploy workflows (in the `staging` and `production` Environments) can sign in to AWS with release rights.
- Agents never approve PRs, merge with admin rights, or deploy staging/production.
- Claude runs on the owner's subscription (`CLAUDE_CODE_OAUTH_TOKEN`), so heavy agent use counts against its limits.
