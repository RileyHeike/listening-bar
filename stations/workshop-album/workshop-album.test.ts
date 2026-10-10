import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { getProjects } from '@bar/content';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Entry from './src/index.astro';

const render = async (slug: string) => {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });
  return container.renderToString(Entry, {
    props: {
      ...stationContext({ pageId: 'project', path: `/workshop/${slug}`, params: { slug } }),
    },
  });
};

describe('workshop-album', () => {
  it.each(getProjects().map((p) => [p.slug, p]))(
    'renders %s as an album',
    async (slug, project) => {
      const html = await render(slug);
      expect(html).toContain(project.title);
      expect(html).toContain(`project-${slug}`);
      expect(html).toContain('bar-tracklist');
    },
  );

  it('fails loudly for an unknown project', async () => {
    await expect(render('nope')).rejects.toThrow(/no project for slug "nope"/);
  });
});
