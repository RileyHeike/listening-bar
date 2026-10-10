import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Entry from './src/index.astro';
import { isWet, statusLine } from './src/store.ts';

describe('window', () => {
  it('renders lattice, sill and a neutral status before the snapshot', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toContain('window__shoji');
    expect(html).toContain('window__plants');
    expect(html).toContain('Looking outside…');
    expect(html).not.toContain('data-raining');
  });

  it('describes the weather', () => {
    expect(statusLine({ condition: 'rain', temperatureC: 11.6 })).toBe('Rain on the glass · 12°C');
    expect(statusLine({ condition: 'clear', summary: 'Still night' })).toBe('Still night');
    expect(isWet({ condition: 'storm' })).toBe(true);
    expect(isWet({ condition: 'fog' })).toBe(false);
  });
});
