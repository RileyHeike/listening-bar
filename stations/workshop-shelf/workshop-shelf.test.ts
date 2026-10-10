import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { getProjects } from '@bar/content';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Entry from './src/index.astro';

describe('workshop-shelf', () => {
  it('shows every non-featured project: tapes for demos, faded sleeves for out of print', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, {
      props: { ...stationContext({ pageId: 'workshop', path: '/workshop' }) },
    });
    for (const project of getProjects().filter((p) => !p.featured)) {
      expect(html).toContain(`href="/workshop/${project.slug}"`);
    }
    expect(html).toContain('bar-cassette');
    expect(html).toContain('data-faded');
    expect(html).toContain('Demo tapes');
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<[^>]+>)*All/);
  });
});
