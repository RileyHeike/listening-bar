import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Entry from './src/index.astro';

describe('counter', () => {
  it('renders both sides statically, with the welcome headline and two actions each', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toContain('Pull up a stool. I&#39;m [Your Name].');
    expect(html).toContain('data-face="A"');
    expect(html).toContain('data-face="B"');
    expect(html.match(/class="bar-button"/g)).toHaveLength(4);
    expect(html).toContain('client="visible"');
  });
});
