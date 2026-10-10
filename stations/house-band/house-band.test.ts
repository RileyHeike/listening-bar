import { describe, expect, it } from 'vitest';
import manifest from './station.ts';

describe('house-band', () => {
  it('is a draft sleeve with its own page', () => {
    expect(manifest).toMatchObject({ draft: true, route: '/house-band', targets: [] });
    expect(manifest.sleeve?.src).toBe('./sleeve.svg');
  });
});
