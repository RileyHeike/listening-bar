import { describe, expect, it } from 'vitest';
import manifest from './station.ts';

describe('crate', () => {
  it('is a draft sleeve with its own page', () => {
    expect(manifest).toMatchObject({ draft: true, route: '/crate', targets: [] });
    expect(manifest.sleeve?.src).toBe('./sleeve.svg');
  });
});
