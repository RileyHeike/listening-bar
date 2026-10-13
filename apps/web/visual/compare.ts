/**
 * Compare this branch's screenshots with `main`'s and classify each one:
 *
 *   unchanged  under NOISE of the pixels differ (anti-aliasing, sub-pixel text)
 *   small      under BIG: judged by the AI reviewer with the diff images
 *   big        BIG or more, or a screenshot that disappeared: the owner
 *              reviews it (the PR gets `needs-design-review`)
 *   added      new screenshot, nothing to compare with
 *
 *   tsx visual/compare.ts <baseline dir> <current dir> <out dir>
 *
 * Writes <out>/diff/<project>/<name>.png for every changed screenshot,
 * <out>/report.json and <out>/summary.md, and `big`/`changed` to
 * $GITHUB_OUTPUT when set. Always exits 0: the owner gate acts on the label.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/** Fractions of the (larger) image's pixels. */
export const NOISE = 0.0005;
export const BIG = 0.02;

export type Category = 'unchanged' | 'small' | 'big' | 'added' | 'removed';

export interface Result {
  name: string;
  category: Category;
  /** Share of pixels that differ, 0–1 (1 when added or removed). */
  ratio: number;
  resized?: { from: [number, number]; to: [number, number] };
}

/** Draw `png` onto a transparent canvas of the given size (top-left aligned). */
function pad(png: PNG, width: number, height: number): PNG {
  if (png.width === width && png.height === height) return png;
  const canvas = new PNG({ width, height });
  PNG.bitblt(png, canvas, 0, 0, png.width, png.height, 0, 0);
  return canvas;
}

export function classify(ratio: number): Category {
  if (ratio < NOISE) return 'unchanged';
  return ratio < BIG ? 'small' : 'big';
}

/** Compare two PNGs; returns the result and, when they differ, a diff image. */
export function compareImages(
  name: string,
  before: PNG,
  after: PNG,
): { result: Result; diff?: PNG } {
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);
  const diff = new PNG({ width, height });
  const pixels = pixelmatch(
    pad(before, width, height).data,
    pad(after, width, height).data,
    diff.data,
    width,
    height,
    { threshold: 0.1, includeAA: false },
  );
  const ratio = pixels / (width * height);
  const resized =
    before.width !== after.width || before.height !== after.height
      ? {
          from: [before.width, before.height] as [number, number],
          to: [after.width, after.height] as [number, number],
        }
      : undefined;
  const category = classify(ratio);
  const result: Result = { name, category, ratio, ...(resized ? { resized } : {}) };
  return category === 'unchanged' ? { result } : { result, diff };
}

function pngs(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.replaceAll('\\', '/'))
    .sort();
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(2)}%`;

export function summarize(results: Result[], baselineFound: boolean): string {
  if (!baselineFound)
    return '## Visual comparison\n\nNo screenshots from `main` to compare with yet; this run becomes the baseline once merged.\n';
  const changed = results.filter((r) => r.category !== 'unchanged');
  const big = changed.filter((r) => r.category === 'big' || r.category === 'removed');
  const lines = ['## Visual comparison', ''];
  if (changed.length === 0) {
    lines.push(`No visual changes across ${results.length} screenshots.`);
    return `${lines.join('\n')}\n`;
  }
  lines.push(
    big.length > 0
      ? `**${big.length} big change(s)**: the owner reviews these (\`needs-design-review\`).`
      : 'Only small changes: the AI reviewer judges whether they are intended.',
    '',
    `Thresholds: unchanged under ${percent(NOISE)} of pixels, big from ${percent(BIG)}.`,
    'Diff images are in the `visual-diff` artifact of this run (changed pixels in red).',
    '',
    '| Screenshot | Change | Pixels differing |',
    '|---|---|---|',
  );
  for (const r of changed) {
    const size = r.resized ? ` (size ${r.resized.from.join('×')} → ${r.resized.to.join('×')})` : '';
    lines.push(`| \`${r.name}\` | ${r.category}${size} | ${percent(r.ratio)} |`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const [baselineDir, currentDir, outDir] = process.argv.slice(2);
  if (!baselineDir || !currentDir || !outDir)
    throw new Error('Usage: compare.ts <baseline dir> <current dir> <out dir>');

  const before = new Set(pngs(baselineDir));
  const after = pngs(currentDir);
  if (after.length === 0) throw new Error(`No screenshots in ${currentDir}.`);
  const baselineFound = before.size > 0;
  const results: Result[] = [];

  for (const name of after) {
    if (!baselineFound) break;
    if (!before.has(name)) {
      results.push({ name, category: 'added', ratio: 1 });
      continue;
    }
    before.delete(name);
    const { result, diff } = compareImages(
      name,
      PNG.sync.read(readFileSync(join(baselineDir, name))),
      PNG.sync.read(readFileSync(join(currentDir, name))),
    );
    results.push(result);
    if (diff) {
      const file = join(outDir, 'diff', name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, PNG.sync.write(diff));
    }
  }
  for (const name of before) results.push({ name, category: 'removed', ratio: 1 });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'report.json'),
    `${JSON.stringify({ baselineFound, results }, null, 2)}\n`,
  );
  const summary = summarize(results, baselineFound);
  writeFileSync(join(outDir, 'summary.md'), summary);
  process.stdout.write(summary);

  const big = results.some((r) => r.category === 'big' || r.category === 'removed');
  const changed = results.filter((r) => r.category !== 'unchanged').length;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `big=${String(big)}\nchanged=${String(changed)}\n`);
  process.stdout.write(`Report: ${relative(process.cwd(), join(outDir, 'report.json'))}\n`);
}

if (process.argv[1] === import.meta.filename) main();
