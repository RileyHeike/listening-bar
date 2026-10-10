import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { getFeaturedProject } from '@bar/content';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

describe('workshop-featured', () => {
  it('owns the Workshop page and its wall sleeve', () => {
    expect(manifest).toMatchObject({ route: '/workshop', name: 'Workshop' });
    expect(manifest.draft).toBeFalsy();
  });

  it('renders the featured project as an album with the sleeve-morph hero', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, {
      props: { ...stationContext({ pageId: 'workshop', path: '/workshop' }) },
    });
    const project = getFeaturedProject();
    expect(html).toContain(project.title);
    expect(html).toContain('view-transition-name: sleeve-workshop-featured');
    expect(html).toContain('bar-tracklist');
    expect(html).toContain(project.catalog);
  });
});
