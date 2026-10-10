import type { ReactElement } from 'react';
import { cx } from './cx.ts';

/**
 * Original, deterministic mid-century geometric cover art: the same seed
 * always draws the same sleeve. Used for placeholders until real art exists.
 * Never a reproduction of real album art.
 */
export interface SleeveArtProps {
  seed: string;
  /** Informative label; omit for decorative art. */
  label?: string;
  className?: string;
}

const COLORS = [
  'var(--signature)',
  'var(--room-metal)',
  'var(--room-alert)',
  'var(--room-wood-light)',
  'var(--room-plant)',
  'var(--room-wood-deep)',
] as const;

/** FNV-1a: small, stable string hash. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: deterministic PRNG in [0, 1). */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Palette {
  ground: string;
  a: string;
  b: string;
  paper: string;
}

type Composition = (p: Palette, rand: () => number) => ReactElement;

const round = (n: number) => Math.round(n * 10) / 10;

const compositions: Composition[] = [
  // Orbit: a solid sun and an offset ring.
  (p, rand) => {
    const cx = round(34 + rand() * 12);
    const cy = round(40 + rand() * 14);
    return (
      <>
        <rect width="100" height="100" fill={p.paper} />
        <circle cx={cx} cy={cy} r="26" fill={p.a} />
        <circle cx={cx + 22} cy={cy + 14} r="20" fill="none" stroke={p.b} strokeWidth="5" />
        <rect x="10" y="86" width="80" height="1.5" fill={p.ground} />
      </>
    );
  },
  // Bars: staggered horizontal bars.
  (p, rand) => (
    <>
      <rect width="100" height="100" fill={p.ground} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x="12"
          y={16 + i * 14}
          width={round(30 + rand() * 50)}
          height="7"
          fill={i % 2 ? p.paper : p.a}
        />
      ))}
      <circle cx="80" cy="80" r="7" fill={p.b} />
    </>
  ),
  // Quarters: a 2×2 grid of rotated quarter circles.
  (p, rand) => (
    <>
      <rect width="100" height="100" fill={p.paper} />
      {[0, 1, 2, 3].map((i) => {
        const x = (i % 2) * 50;
        const y = Math.floor(i / 2) * 50;
        const turn = Math.floor(rand() * 4) * 90;
        return (
          <g key={i} transform={`rotate(${turn} ${x + 25} ${y + 25})`}>
            <path d={`M${x} ${y} h50 a50 50 0 0 1 -50 50 Z`} fill={i % 3 ? p.a : p.b} />
          </g>
        );
      })}
    </>
  ),
  // Horizon: a half sun on a split field.
  (p, rand) => {
    const horizon = round(52 + rand() * 12);
    return (
      <>
        <rect width="100" height="100" fill={p.paper} />
        <rect y={horizon} width="100" height={100 - horizon} fill={p.ground} />
        <path d={`M22 ${horizon} a28 28 0 0 1 56 0 Z`} fill={p.a} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="22" y={horizon + 8 + i * 8} width="56" height="2.5" fill={p.b} />
        ))}
      </>
    );
  },
  // Nested squares.
  (p, rand) => {
    const drop = round(4 + rand() * 6);
    return (
      <>
        <rect width="100" height="100" fill={p.ground} />
        <rect x="14" y={14 + drop / 2} width="72" height="72" fill={p.a} />
        <rect x="26" y={26 + drop} width="48" height="48" fill={p.b} />
        <rect x="38" y={38 + drop * 1.5} width="24" height="24" fill={p.paper} />
      </>
    );
  },
];

export function SleeveArt({ seed, label, className }: SleeveArtProps) {
  const h = hash(seed);
  const rand = random(h);
  const pick = (offset: number) => COLORS[(h >>> offset) % COLORS.length] ?? COLORS[0];
  const a = pick(3);
  let b = pick(9);
  if (b === a) b = COLORS[(COLORS.indexOf(a) + 2) % COLORS.length] ?? COLORS[0];
  const palette: Palette = { ground: pick(15), a, b, paper: 'var(--room-paper)' };
  if (palette.ground === a) palette.ground = 'var(--room-wood-deep)';
  const compose = compositions[h % compositions.length] ?? compositions[0];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };

  return (
    <svg
      className={cx('bar-sleeve-art', className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
      {...a11y}
    >
      {compose?.(palette, rand)}
    </svg>
  );
}
