# Autonomous agent workflow

Agents implement, verify, evaluate, review and merge work on their own.
The owner is asked only about architecture decisions and design vision.

## The loop

1. **Intake.** Work starts as an issue (the "Task" form), written so it can be finished without questions: goal, acceptance criteria, out of scope.
   Labelling it `agent` (or commenting `@claude` on an issue or PR) hands it to an agent.
2. **Implement.** The agent works on its own branch with the generators and `docs/how-to/`, verifies locally, and opens a PR with auto-merge enabled.
3. **Verify.** The PR pipeline runs on every push:

   | Check | What it proves |
   |---|---|
   | `checks` | format, typecheck, lint, unit/contract/CDK tests, production-build exclusions, Playwright on a local build |
   | `pr-title` | the title is a Conventional Commit (it becomes the squash commit) |
   | `workflow-lint` | workflows pass actionlint and the zizmor security audit |
   | `generators` | when generator inputs changed, every generator's output still passes every check |
   | `visual` | screenshots of every page, compared with `main` (see below) |

4. **Merge.** Once every required check passes, auto-merge squashes the PR into `main`, which deploys staging; production still waits for the owner's approval.

## When the owner is asked

- **Owner-reviewed paths** (`.github/CODEOWNERS`): decisions, contracts, the agent rules, design tokens, infrastructure, CI and repo tooling.
  PRs touching them wait for the owner's review even when everything passes.
- **Decisions.** An agent that needs a decision that is Open, Parked or not covered in `docs/decisions.md` asks in a comment (options and trade-offs), labels the PR or issue `needs-owner`, and stops.

## Visual changes

`visual.yml` screenshots every page in both lighting modes, and the room in every lighting phase, on desktop and phone.
The clock is fixed and motion reduced, so the same code always produces the same pixels.
Each push to `main` keeps its screenshots as the baseline; each PR is compared with it and gets a comment listing what changed.

- **Unchanged** (under 0.05% of pixels): nothing to do.
- **Small** (under 2%): the AI reviewer judges whether the change is intended, using the diff images in the run's `visual-diff` artifact.
- **Big** (2% or more, or a screenshot that disappeared): the PR is labelled `needs-design-review` and the owner reviews the design.

To look at the screenshots locally: `pnpm --filter @bar/web test:visual` writes them to `apps/web/visual-results/current/`.
Thresholds are in `apps/web/visual/compare.ts`.

## Labels

| Label | Meaning |
|---|---|
| `agent` | an agent should implement this issue |
| `needs-owner` | waiting on an owner decision; agents stop |
| `needs-design-review` | the change alters the look beyond the visual threshold; waiting on the owner |

## Parallel work

- In GitHub, each agent runs in its own job on its own branch.
- Locally, run parallel agents in separate git worktrees (`git worktree add ../bar-<task> -b <type>/<task>`), each with its own sandbox: `BAR_SANDBOX_USER=<name> pnpm sandbox:deploy`.
  The dev server picks the next free port.

## Guardrails

- `.claude/settings.json` pre-approves the everyday commands and denies pushing to `main`, force-pushing, approving or admin-merging PRs, and deploying or destroying shared environments.
- Agents never approve PRs, merge with admin rights, or deploy staging/production.
