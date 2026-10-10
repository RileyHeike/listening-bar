import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

const render = async (path = '/') => {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });
  return container.renderToString(Entry, { props: { ...stationContext({ path }) } });
};

describe('site-header', () => {
  it('lives in the layout header and hydrates on load', () => {
    expect(manifest).toMatchObject({ targets: ['layout:header'], hydrate: 'load' });
  });

  it('renders the sign, manifest nav and controls without JavaScript', async () => {
    const html = await render();
    expect(html).toContain('[BAR NAME]');
    expect(html).toContain('a listening bar');
    expect(html).toMatch(/href="\/workshop"[^>]*>\s*Workshop/);
    expect(html).toContain('Lights up');
  });

  it('shows hours, not a guess, before the clock runs', async () => {
    const html = await render();
    expect(html).toContain('Open 12pm–2am');
    expect(html).not.toContain('Closed');
  });

  it('marks the current section', async () => {
    expect(await render('/workshop/some-project')).toMatch(/aria-current="page"[^>]*>\s*Workshop/);
  });
});
