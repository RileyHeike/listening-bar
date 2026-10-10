import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

describe('chalkboard', () => {
  it('listens for menu updates', () => {
    expect(manifest.listens).toEqual(['menu.updated']);
  });

  it('renders the menu seed in the static shell, all six rows', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toMatch(/Tonight(&#39;|')s menu/);
    for (const label of ['On rotation', 'Reading', 'Growing', 'Learning', 'Building', 'Drinking']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('[A record]');
  });
});
