# Design system

Aesthetic: a Japanese jazz-kissa listening bar in a mid-century modern
register. Japanese restraint shapes layout and spacing (ma, natural materials,
calm); mid-century modern shapes color and type. Records and plants are the
personal details. Avoid retro kitsch (no starbursts/boomerangs).

Values here are the starting point; the owner will fine-tune them. Change
looks only through tokens.

## Tokens (three layers)

**1. Materials**

| Token | Value | Token | Value |
|---|---|---|---|
| `--walnut-900` | #1E140E | `--washi` | #EFE5D0 |
| `--walnut-800` | #2A1C13 | `--paper` | #F6F0E4 |
| `--walnut-700` | #3A2719 | `--cream` | #F2E8D5 |
| `--walnut-500` | #6B4426 | `--cream-soft` | #CDBFA6 |
| `--teak` | #8A5A34 | `--forest` | #2F4A32 |
| `--brass` | #C9A15A | `--moss` | #8DA66B |
| `--persimmon` | #C4652F | | |

**2. Room roles** (the only color tokens stations use): `--room-bg`,
`--room-surface`, `--room-line`, `--room-ink`, `--room-ink-soft`,
`--room-glow`, `--window-sky`, `--signature` (default `--forest`; tweakable
accent). Register color roles with `@property` so phase changes transition.

**3. Modifiers** on `<html>`:

| Phase | --room-bg | --room-surface | --room-glow | --window-sky |
|---|---|---|---|---|
| dawn | #2A1F18 | #3A2B20 | #D9A77A | #8A9AA6 |
| day | #33251B | #433024 | #E6C58A | #A9BFC9 |
| golden | #2E1D12 | #3F2818 | #E0A04A | #D39A5F |
| evening (default) | #1E140E | #2A1C13 | #C9A15A | #28343B |
| night | #170F0A | #22170F | #B88D4A | #141C22 |
| after-hours | #100A07 | #1A110B | #8F6A35 | #0C1115 |

- `data-tone="paper"` (Workshop, Liner Notes): bg `--washi`, surface #E6D9BF,
  ink `--walnut-800`, ink-soft #5E4A3A, glow `--teak`; ignores phase.
- `data-lights="up"` always wins: bg #FFFFFF, surface #F3F3F1, ink #161616,
  ink-soft #474747, glow `--forest`, display font → sans, motion off.

## Type

| Role | Family | Use |
|---|---|---|
| Sans | Jost (fallback Futura, Century Gothic) | body, UI |
| Display | Shippori Mincho (fallback Georgia) | headings, record titles, shop sign |
| Mono | DM Mono | pressing info, catalog numbers, small data |
| Chalk | Caveat | chalkboard only, sparingly |

Scale: 0.875 / 1.0625 / 1.25 / 1.625 / 2.5 / 3.75 rem. Sentence case for
labels; keep tracked all-caps rare. Line length under ~70ch.

## Space and motion tokens

Space: 0.5 / 1 / 1.5 / 2.5 / 4 / 6 rem; container 80rem; measure 34rem.
Motion: `--ease-settle` cubic-bezier(.2,.8,.2,1), `--ease-heavy`
cubic-bezier(.65,0,.35,1), `--dur-quick` 180ms, `--dur-move` 600ms,
`--dur-light` 6s, `--rpm-33` 1.8s. Same values exported to TS.

## Placeholder stations (visual spec)

Bracketed text (`[BAR NAME]`, `[Your Name]`, `[Your role]`…) is placeholder
copy; keep the brackets so it is obvious.

- **Header (layout)**: crest (concentric rings + leaf) + "[BAR NAME]" in
  display + "a listening bar" in small mono; nav from manifests; open/closed
  pill driven by owner-local hours; "Lights up" button with bulb icon.
- **Noren (room:entrance)**: brass/teak rod; four `--signature` fabric panels
  with small gaps and a cream crest centered across the split. Entrance
  animation: panels settle closed as if just walked through (once/session).
- **Counter (room:counter)**: Side A/B segmented toggle; display headline
  "Pull up a stool. I'm [Your Name]."; short intro; two actions. Side change
  flips content.
- **Hi-fi (room:hifi)**: walnut plinth turntable (SVG): platter, grooved
  record, `--signature` label, brass tonearm that swings off when idle,
  33⅓ indicator; now-spinning text (source, title, artist/year, side/track);
  two cream VU meters with persimmon red zone; "Recently spun" list.
  Idle state: "Between records".
- **Record wall (room:wall)**: original geometric mid-century sleeves (never
  reproductions of real album art), name + blurb under each; walnut shelf
  plank below. Hover/focus pulls the sleeve; click morphs into destination
  hero.
- **Chalkboard (room:menu)**: slate board in a walnut frame; "Tonight's menu"
  in chalk; rows: on rotation, reading, growing, learning, building,
  drinking. Live content (fixture-backed for now).
- **Window (room:window)**: shoji lattice over `--window-sky`; rain layer when
  weather is rain; plants on the sill; small status line below.
- **Workshop (paper tone)**: title, status filter pills (Demo tapes, In the
  studio, Pressed, Out of print with color dots: brass, persimmon, forest,
  grey); featured release as an album (cover, pressing info, tracklist as
  milestones, credits, actions); shelf grid of sleeves, cassettes for demo
  tapes, faded sleeve for out of print.
- **Liner Notes (paper tone)**: name, role, summary, availability pill
  ("Happily employed, open to a good conversation"); meishi card that flips;
  discography of roles as album eras with "standout tracks"; skills grouped as
  instruments/studio gear/genres; contact form on walnut (UI only).

## Accessibility floor

Text contrast 4.5:1 (3:1 at 24px+), visible focus, 44px targets, real
buttons/links/labels, decorative SVG `aria-hidden`, informative SVG
`role="img"` + label, reduced motion respected, lights-up mode fully usable.
