import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import {
  duration,
  easing,
  layout,
  materialTokens,
  registeredColorRoles,
  space,
  typeScale,
} from '../src/tokens.ts';

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');

/** Declarations in the first `:root { … }` block. */
const rootBlock = /\n:root \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const rootValue = (name: string) =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(rootBlock)?.[1]?.trim();

describe('tokens.css ↔ tokens.ts', () => {
  it('durations match', () => {
    expect(rootValue('dur-quick')).toBe(`${duration.quick}ms`);
    expect(rootValue('dur-move')).toBe(`${duration.move}ms`);
    expect(rootValue('dur-light')).toBe(`${duration.light / 1000}s`);
    expect(rootValue('rpm-33')).toBe(`${duration.rpm33 / 1000}s`);
  });

  it('easings match', () => {
    expect(rootValue('ease-settle')).toBe(`cubic-bezier(${easing.settle.join(', ')})`);
    expect(rootValue('ease-heavy')).toBe(`cubic-bezier(${easing.heavy.join(', ')})`);
  });

  it('type, space and layout scales match', () => {
    for (const [name, rem] of Object.entries(typeScale)) {
      expect(rootValue(`type-${name}`), name).toBe(`${rem}rem`);
    }
    space.forEach((rem, index) => {
      expect(rootValue(`space-${index + 1}`)).toBe(`${rem}rem`);
    });
    expect(rootValue('container')).toBe(`${layout.container}rem`);
    expect(rootValue('measure')).toBe(`${layout.measure}rem`);
  });

  it('defines exactly the listed materials', () => {
    const section = rootBlock.slice(0, rootBlock.indexOf('2. Room roles'));
    const defined = [...section.matchAll(/--([\w-]+):/g)].map((m) => m[1]);
    expect(defined).toEqual([...materialTokens]);
  });

  it('registers every transitionable color role with @property', () => {
    for (const role of registeredColorRoles) {
      expect(css).toContain(`@property --${role} {`);
    }
  });

  it.each(['dawn', 'day', 'golden', 'evening', 'night', 'after-hours'])(
    'phase %s sets bg, surface, glow and sky',
    (phase) => {
      const block = new RegExp(`\\[data-phase='${phase}'\\] \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      for (const role of ['room-bg', 'room-surface', 'room-glow', 'window-sky']) {
        expect(block, role).toMatch(new RegExp(`--${role}: #[0-9a-f]{6};`));
      }
    },
  );

  it('lights up is declared last so it always wins', () => {
    expect(css.lastIndexOf(":root[data-lights='up']")).toBeGreaterThan(
      css.lastIndexOf(":root[data-tone='paper']"),
    );
  });
});

describe('bar/no-material-tokens', () => {
  const lint = (code: string) =>
    stylelint.lint({
      code,
      config: {
        plugins: [fileURLToPath(new URL('../stylelint/plugin.js', import.meta.url))],
        rules: { 'bar/no-material-tokens': true },
      },
    });

  it('rejects material tokens', async () => {
    const { results } = await lint(
      '.a { color: var(--walnut-500); border: 1px solid var(--brass, red); }',
    );
    expect(results[0]?.warnings.map((w) => w.text)).toEqual([
      expect.stringContaining('"--walnut-500"'),
      expect.stringContaining('"--brass"'),
    ]);
  });

  it('allows room roles', async () => {
    const { results } = await lint('.a { color: var(--room-ink); background: var(--room-wood); }');
    expect(results[0]?.warnings).toEqual([]);
  });
});
