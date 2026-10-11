import { act } from '@testing-library/react';
import { atom } from 'nanostores';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { $lights, $motion } from '../src/stores.ts';
import { useRoomStore } from '../src/use-store.ts';

describe('useRoomStore', () => {
  it('shows data that arrived before hydration', async () => {
    const $weather = atom('unknown');
    const Probe = () => <p>{useRoomStore($weather)}</p>;

    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    expect(container.textContent).toBe('unknown');

    // The snapshot lands while the island is still static HTML.
    $weather.set('rain');

    await act(async () => {
      hydrateRoot(container, <Probe />);
    });
    expect(container.textContent).toBe('rain');

    act(() => {
      $weather.set('clear');
    });
    expect(container.textContent).toBe('clear');
  });

  it('hydrates "unknown yet" (undefined) stores without a mismatch', async () => {
    const $track = atom<string | undefined>(undefined);
    const Probe = () => <p>{useRoomStore($track) ?? 'Tuning in'}</p>;
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    $track.set('[Track]');
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('[Track]');
  });

  it('hydrates computed stores with their server value', async () => {
    $lights.set('up');
    const Probe = () => <p>{useRoomStore($motion) ? 'moving' : 'still'}</p>;
    const container = document.createElement('div');
    container.innerHTML = '<p>moving</p>';
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('still');
    $lights.set('dim');
  });
});
