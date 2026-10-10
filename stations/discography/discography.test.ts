import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { getRoles } from '@bar/content';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Entry from './src/index.astro';

describe('discography', () => {
  it('lists every role as an era, current first, with skills grouped', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    const roles = getRoles();
    expect(html.match(/class="era"/g)).toHaveLength(roles.length);
    expect(html.indexOf(roles[0]!.title)).toBeLessThan(html.indexOf(roles[1]!.title));
    expect(html).toContain('–now');
    expect(html).toContain('Standout tracks');
    for (const group of ['Instruments', 'Studio gear', 'Genres']) expect(html).toContain(group);
  });
});
