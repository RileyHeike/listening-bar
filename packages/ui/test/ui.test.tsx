import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Button,
  Cassette,
  Crest,
  Pill,
  PillButton,
  Sleeve,
  SleeveArt,
  StatusDot,
} from '../src/index.ts';

afterEach(cleanup);

describe('Button', () => {
  it('renders a real button with type="button" by default', () => {
    render(<Button>Pull up a stool</Button>);
    expect(screen.getByRole('button', { name: 'Pull up a stool' })).toHaveProperty(
      'type',
      'button',
    );
  });

  it('renders a link when href is set', () => {
    render(
      <Button href="/workshop" variant="outline">
        Workshop
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Workshop' }).getAttribute('href')).toBe('/workshop');
  });

  it('hides decorative icons from assistive tech', () => {
    render(<Button icon={<svg />}>Lights up</Button>);
    expect(screen.getByRole('button', { name: 'Lights up' })).toBeTruthy();
  });
});

describe('Pill / PillButton', () => {
  it('renders a static pill with an optional dot', () => {
    const { container } = render(<Pill dot="open">Open</Pill>);
    expect(container.querySelector('[data-status="open"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('exposes pressed state', () => {
    render(
      <PillButton pressed onClick={() => undefined}>
        Pressed
      </PillButton>,
    );
    expect(screen.getByRole('button', { name: 'Pressed' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('Sleeve', () => {
  it('is one link carrying name and blurb', () => {
    render(<Sleeve name="Workshop" blurb="Things I build" href="/workshop" />);
    expect(screen.getByRole('link', { name: /Workshop.*Things I build/ })).toBeTruthy();
  });

  it('puts the view-transition name on the cover', () => {
    const { container } = render(<Sleeve name="Crate" transitionName="sleeve-crate" />);
    const cover = container.querySelector<HTMLElement>('.bar-sleeve__cover');
    expect(cover?.style.getPropertyValue('view-transition-name')).toBe('sleeve-crate');
  });

  it('uses the image with explicit dimensions when given', () => {
    const { container } = render(<Sleeve name="Tours" src="/sleeve.svg" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('width')).toBe('600');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('marks faded sleeves', () => {
    const { container } = render(<Sleeve name="Old" faded />);
    expect(container.querySelector('[data-faded]')).toBeTruthy();
  });
});

describe('SleeveArt', () => {
  it('is deterministic per seed', () => {
    const a = renderToStaticMarkup(<SleeveArt seed="workshop" />);
    expect(renderToStaticMarkup(<SleeveArt seed="workshop" />)).toBe(a);
    expect(renderToStaticMarkup(<SleeveArt seed="liner-notes" />)).not.toBe(a);
  });

  it('draws only with role tokens', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const markup = renderToStaticMarkup(<SleeveArt seed={seed} />);
      expect(markup).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });

  it('is decorative unless labeled', () => {
    expect(renderToStaticMarkup(<SleeveArt seed="x" />)).toContain('aria-hidden="true"');
    render(<SleeveArt seed="x" label="Cover art" />);
    expect(screen.getByRole('img', { name: 'Cover art' })).toBeTruthy();
  });
});

describe('Crest, StatusDot, Cassette', () => {
  it('crest is decorative by default and informative with a label', () => {
    expect(renderToStaticMarkup(<Crest />)).toContain('aria-hidden="true"');
    render(<Crest label="[BAR NAME] crest" />);
    expect(screen.getByRole('img', { name: '[BAR NAME] crest' })).toBeTruthy();
  });

  it('status dot is decorative', () => {
    expect(renderToStaticMarkup(<StatusDot status="pressed" />)).toContain('aria-hidden="true"');
  });

  it('cassette label is real text', () => {
    render(<Cassette label="[Demo tape]" sublabel="Demo · 2026" />);
    expect(screen.getByText('[Demo tape]')).toBeTruthy();
  });
});
