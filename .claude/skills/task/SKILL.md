---
name: task
description: Turn a rough idea into a well-formed GitHub issue (the Task form) that an agent can finish without questions. Use when the owner describes something to build or fix.
argument-hint: '<rough idea>'
---

Write an issue an agent can implement end to end, from: $ARGUMENTS

1. Read `docs/decisions.md` and the docs CLAUDE.md lists for the areas involved, and look at the code the work would touch.
2. If the idea needs a decision that is Open, Parked or not covered, or changes the design vision, ask the owner first (options and trade-offs). Do not write the issue around an unmade decision.
3. Draft the issue in the shape of `.github/ISSUE_TEMPLATE/agent-task.yml`:
   - **Goal**: one or two sentences on the outcome, not the implementation.
   - **Acceptance criteria**: observable and testable, including reduced motion and lights-up behaviour for anything visible.
   - **Out of scope**: what a diligent agent might otherwise add.
   - **Pointers**: the generators, how-tos, contracts and files to start from.
   Keep one issue to one PR's worth of work; split larger ideas into several issues and say in which order.
4. Show the draft to the owner. After they approve it, create it with `gh issue create --title "…" --body-file <file>`.
   Do not add the `agent` label: the owner hands issues to agents.
