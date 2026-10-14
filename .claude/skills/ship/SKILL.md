---
name: ship
description: Verify, self-review, commit and open a pull request with auto-merge for the current branch, following the repository's agent loop. Use when a change is ready to go.
argument-hint: '[issue number]'
---

Ship the work on the current branch (docs/agents.md, "The loop").

1. **Branch.** If on `main`, stop: create `<type>/<short-slug>` first and move the work there.
2. **Verify.** Run `pnpm typecheck && pnpm lint && pnpm test`; for anything visible also `pnpm test:e2e`, and look at the screenshots with `pnpm --filter @bar/web test:visual` (`apps/web/visual-results/current/`).
   Fix failures at their cause; never weaken a test or a check.
3. **Self-review.** Ask the `reviewer` subagent to review `git diff origin/main...HEAD` (and the `design-reviewer` for visual or token changes).
   Fix blocking findings. If it needs an owner decision, stop and ask instead of opening the PR.
4. **Commit.** Conventional Commits (`feat(<package>): …`), no agent co-author trailer.
5. **PR.** Write the body from `.github/pull_request_template.md` (with "Closes #$ARGUMENTS" when an issue was given): what and why, how it was verified, the checklist ticked honestly.
   `git push -u origin HEAD`, then `gh pr create --base main --title "<conventional title>" --body-file <file>` and `gh pr merge --auto --squash`.
6. **Report** the PR link, and whether it touches owner-reviewed paths (`.github/CODEOWNERS`), in which case it waits for the owner.
