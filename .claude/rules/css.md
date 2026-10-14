---
paths:
  - '**/*.css'
  - '**/*.astro'
---

# Styles

- Aesthetics live in tokens (`docs/design-system.md`).
  Station and `@bar/ui` styles use room-role tokens (`--room-*`, `--signature`) and the type, space and motion tokens.
  Never raw colours (hex, named, `rgb()`/`hsl()`…) or material tokens; Stylelint enforces this and reports after each edit.
- Changing the tokens themselves (`packages/tokens/`) changes the design vision: the owner reviews it.
- Animate only `transform` and `opacity` (`filter` sparingly), behind `[data-motion]`.
