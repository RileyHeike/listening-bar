import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

describe('liner-intro', () => {
  it('owns the Liner Notes page and its sleeve', () => {
    expect(manifest).toMatchObject({ route: '/liner-notes', name: 'Liner Notes' });
  });

  it('renders the intro, availability, and the meishi front side up', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, {
      props: { ...stationContext({ pageId: 'liner-notes', path: '/liner-notes' }) },
    });
    expect(html).toContain('<h1');
    expect(html).toContain('[Your Name]');
    expect(html).toContain('Happily employed, open to a good conversation');
    expect(html).toContain('view-transition-name: sleeve-liner-intro');
    expect(html).toContain('Turn the card over');
    expect(html).not.toContain('data-flipped');
  });
});
