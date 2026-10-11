import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Builds the site as production would and proves dev-only tooling and
 * fixture data never ship. Slow (one full build), so it runs once.
 */
const appDir = fileURLToPath(new URL('..', import.meta.url));
let outDir = '';
let files: string[] = [];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'bar-prod-'));
  execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', outDir], {
    cwd: appDir,
    env: { ...process.env, BAR_ENV: 'production' },
    stdio: 'pipe',
  });
  files = walk(outDir);
}, 180_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

const containing = (needle: string) =>
  files.filter(
    (file) => /\.(html|js|css|json)$/.test(file) && readFileSync(file, 'utf8').includes(needle),
  );

describe('production build', () => {
  it('excludes the control panel', () => {
    expect(containing('data-bar-control-panel')).toEqual([]);
    expect(containing('Control panel')).toEqual([]);
  });

  it('excludes dev pages and draft stations', () => {
    const pages = files
      .filter((file) => file.endsWith('.html'))
      .map((file) => file.slice(outDir.length));
    expect(pages.some((page) => page.startsWith('/dev/'))).toBe(false);
    expect(pages.some((page) => page.startsWith('/crate'))).toBe(false);
    expect(containing('Being pressed')).toEqual([]);
  });

  it('excludes fixture data and reads endpoints from /config.json', () => {
    expect(containing('Light rain on the glass')).toEqual([]);
    expect(containing('[Track title]')).toEqual([]);
    expect(containing('/config.json').length).toBeGreaterThan(0);
  });
});
