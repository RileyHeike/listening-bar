import { describe, expect, it } from 'vitest';
import manifest from './station.ts';

describe('notebook', () => {
  it('is a draft sleeve with its own page', () => {
    expect(manifest).toMatchObject({ draft: true, route: '/notebook', targets: [] });
    expect(manifest.sleeve?.src).toBe('./sleeve.svg');
  });
});
