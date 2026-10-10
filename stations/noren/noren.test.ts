import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

describe('noren', () => {
  it('hangs at the room entrance', () => {
    expect(manifest.targets).toEqual(['room:entrance']);
  });

  it('renders four panels with the crest split across the middle, at rest', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html.match(/class="noren__panel"/g)).toHaveLength(4);
    expect(html).toContain('data-half="left"');
    expect(html).toContain('data-half="right"');
    expect(html).not.toContain('data-entering');
  });
});
