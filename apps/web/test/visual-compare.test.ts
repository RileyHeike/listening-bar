import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { BIG, NOISE, classify, compareImages, summarize } from '../visual/compare.ts';

/** A solid image, optionally with the first `changed` pixels painted red. */
function image(width: number, height: number, changed = 0): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const red = i < changed;
    png.data.set(red ? [255, 0, 0, 255] : [20, 20, 30, 255], i * 4);
  }
  return png;
}

describe('visual comparison', () => {
  it('classifies by the share of differing pixels', () => {
    expect(classify(0)).toBe('unchanged');
    expect(classify(NOISE / 2)).toBe('unchanged');
    expect(classify(NOISE)).toBe('small');
    expect(classify(BIG)).toBe('big');
  });

  it('ignores identical screenshots and returns no diff image', () => {
    const { result, diff } = compareImages('a.png', image(100, 100), image(100, 100));
    expect(result).toEqual({ name: 'a.png', category: 'unchanged', ratio: 0 });
    expect(diff).toBeUndefined();
  });

  it('flags a small change for the AI reviewer and a big one for the owner', () => {
    expect(compareImages('a.png', image(100, 100), image(100, 100, 50)).result.category).toBe(
      'small',
    );
    expect(compareImages('a.png', image(100, 100), image(100, 100, 500)).result.category).toBe(
      'big',
    );
  });

  it('compares screenshots of different heights on a shared canvas', () => {
    const { result, diff } = compareImages('a.png', image(100, 100), image(100, 120));
    expect(result.resized).toEqual({ from: [100, 100], to: [100, 120] });
    expect(result.category).toBe('big');
    expect(diff?.height).toBe(120);
  });

  it('summarizes changes, and says when there is no baseline yet', () => {
    expect(summarize([], false)).toContain('No screenshots from `main`');
    expect(summarize([{ name: 'x.png', category: 'unchanged', ratio: 0 }], true)).toContain(
      'No visual changes across 1 screenshots.',
    );
    const summary = summarize(
      [
        { name: 'desktop/room.png', category: 'big', ratio: 0.05 },
        { name: 'phone/room.png', category: 'small', ratio: 0.001 },
      ],
      true,
    );
    expect(summary).toContain('**1 big change(s)**');
    expect(summary).toContain('| `desktop/room.png` | big | 5.00% |');
  });
});
