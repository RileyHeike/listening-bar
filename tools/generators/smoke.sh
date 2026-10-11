#!/usr/bin/env bash
# Generator smoke test: run every generator in a throwaway git worktree, then
# prove the output passes typecheck, lint, tests and a site build.
# Used by .github/workflows/generators.yml; safe to run locally.
#
#   tools/generators/smoke.sh            # uses a temp worktree of HEAD
#   SMOKE_IN_PLACE=1 tools/generators/smoke.sh   # CI: mutate the checkout
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
if [[ "${SMOKE_IN_PLACE:-}" == "1" ]]; then
  work="$root"
else
  work="$(mktemp -d)/smoke"
  git -C "$root" worktree add --detach "$work" HEAD >/dev/null
  # Include uncommitted changes so the test reflects the working tree.
  git -C "$root" diff HEAD --binary | git -C "$work" apply --allow-empty
  (cd "$root" && git ls-files --others --exclude-standard -z | tar --null -cf - -T -) | tar -xf - -C "$work"
  trap 'git -C "$root" worktree remove --force "$work"' EXIT
fi
cd "$work"

pnpm install --frozen-lockfile --prefer-offline >/dev/null

echo "▸ Missing flags must fail with usage"
if pnpm --silent gen station --id smoke-only >/dev/null 2>&1; then
  echo "✖ pnpm gen accepted missing flags" >&2
  exit 1
fi

echo "▸ Running generators"
pnpm --silent gen event --type smoke.happened --domain smoke --kind state
pnpm --silent gen page --id smoke-page --route /smoke --slots intro,body
pnpm --silent gen page --id smoke-detail --route /smoke/[slug] --slots main
pnpm --silent gen station --id smoke-island --name "Smoke island" --target smoke-page:intro
pnpm --silent gen station --id smoke-static --name "Smoke static" --target room:wall --hydrate none
pnpm --silent gen station --id smoke-draft --name "Smoke draft" --target smoke-page:body --route /smoke-draft
pnpm --silent gen module --name smoke-module

echo "▸ Checking generated output"
pnpm turbo run typecheck lint test --continue --output-logs=errors-only
pnpm exec prettier --check .
BAR_ENV=local pnpm turbo run build --filter=@bar/web --output-logs=errors-only
(cd infra && pnpm exec cdk synth -c env=sandbox -c user=smoke --quiet >/dev/null)
grep -q '"smoke-module"' infra/.generated/dev-smoke-api.ts

echo "✔ Generators produce code that passes every check"
