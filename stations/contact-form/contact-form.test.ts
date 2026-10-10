import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { stationContext } from '@bar/fixtures';
import { loadRenderers } from 'astro:container';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { validate } from './src/ContactForm.tsx';
import Entry from './src/index.astro';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe('contact-form', () => {
  it('renders a labeled form in the static shell', async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(Entry, { props: { ...stationContext() } });
    expect(html).toContain('id="contact"');
    for (const id of ['contact-name', 'contact-email', 'contact-message']) {
      expect(html).toContain(`for="${id}"`);
    }
  });

  it('validates with specific messages', () => {
    expect(validate(form({ name: '', email: 'nope', message: 'hi' }))).toEqual({
      name: 'Add your name.',
      email: 'Add an email address I can reply to.',
      message: 'Write a little more (at least 10 characters).',
    });
    expect(validate(form({ name: 'A', email: 'a@b.co', message: 'Hello there, bar.' }))).toEqual(
      {},
    );
  });
});
