import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

describe('site-footer', () => {
  it('has a valid manifest', () => {
    expect(manifest.targets).toEqual(['layout:footer']);
  });

  it('renders a complete static footer with nav from manifests', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toContain('<footer class="site-footer"');
    expect(html).toContain('[BAR NAME]');
    expect(html).toContain('href="/workshop"');
    expect(html).not.toContain('astro-island');
  });
});
