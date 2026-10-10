import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Entry from './src/index.astro';

describe('record-wall', () => {
  it('renders a sleeve per wall entry, each a link with its view-transition name', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toContain('href="/workshop"');
    expect(html).toContain('view-transition-name:sleeve-workshop-featured');
    expect(html).toContain('Being pressed');
    expect(html).toContain('record-wall__plank');
  });
});
