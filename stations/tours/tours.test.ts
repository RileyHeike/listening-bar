import { describe, expect, it } from 'vitest';
import manifest from './station.ts';

describe('tours', () => {
  it('is a draft sleeve with its own page', () => {
    expect(manifest).toMatchObject({ draft: true, route: '/tours', targets: [] });
    expect(manifest.sleeve?.src).toBe('./sleeve.svg');
  });
});
