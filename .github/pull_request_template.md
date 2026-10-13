## What and why

<!-- One or two sentences. Link the issue: "Closes #123". -->

## How it was verified

<!-- Commands run, preview URL checked, screenshots if visual. -->

## Definition of done

- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass
- [ ] Follows the relevant contract (`docs/contracts/`); generators used for new stations, modules, events, pages
- [ ] Static shells render with JavaScript off; no layout shift on hydration
- [ ] Reduced motion and lights up checked for any visual change
- [ ] Role tokens only in station CSS; motion goes through `useMotion()`
- [ ] Docs updated if behaviour or a how-to changed

## Decisions

- [ ] This PR makes **no** product or architecture decision beyond `docs/decisions.md`
- [ ] Or: it needs the owner's call — question stated below and the PR is labelled `needs-owner`

<!-- If a decision is needed: state the options and trade-offs here. -->
