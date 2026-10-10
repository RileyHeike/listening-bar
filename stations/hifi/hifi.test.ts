import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from './station.ts';
import Entry from './src/index.astro';

describe('hifi', () => {
  it('listens to the music domain', () => {
    expect(manifest.listens).toEqual(['track.changed', 'track.stopped', 'spins.updated']);
  });

  it('renders the full console with neutral placeholders before the snapshot', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toContain('class="hifi__deck"');
    expect(html.match(/class="hifi__vu"/g)).toHaveLength(2);
    expect(html).toContain('Tuning in…');
    expect(html).toContain('Recently spun');
    expect(html).not.toContain('data-on-record');
  });
});
