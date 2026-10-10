import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StationBoundary } from '../src/boundary.tsx';
import { useStationLifecycle } from '../src/lifecycle.ts';
import { createTicker, useMotion } from '../src/motion.ts';
import { $lights } from '../src/stores.ts';

afterEach(cleanup);

describe('StationBoundary', () => {
  it('falls back to the static shell when the island throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error('boom');
    };
    render(
      <StationBoundary station="hifi" fallback={<p>Static shell</p>}>
        <Broken />
      </StationBoundary>,
    );
    expect(screen.getByText('Static shell')).toBeTruthy();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('[station:hifi]'),
      expect.any(Error),
      expect.anything(),
    );
    error.mockRestore();
  });
});

describe('useMotion', () => {
  it('follows the motion switch', () => {
    const Probe = () => <p>{useMotion() ? 'moving' : 'still'}</p>;
    $lights.set('dim');
    render(<Probe />);
    expect(screen.getByText('moving')).toBeTruthy();
    act(() => {
      $lights.set('up');
    });
    expect(screen.getByText('still')).toBeTruthy();
    $lights.set('dim');
  });
});

describe('useStationLifecycle', () => {
  it('enters on mount and leaves once, at the router swap', () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const Probe = () => {
      useStationLifecycle({ onEnter, onLeave });
      return null;
    };
    const { unmount } = render(<Probe />);
    expect(onEnter).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('astro:before-swap'));
    unmount();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe('ticker', () => {
  it('runs one loop only while it has callbacks, with clamped deltas', () => {
    let pending: FrameRequestCallback | null = null;
    const raf = vi.fn((cb: FrameRequestCallback) => {
      pending = cb;
      return 1;
    });
    const caf = vi.fn();
    const ticker = createTicker(raf, caf);
    const a = vi.fn();
    const b = vi.fn();
    const removeA = ticker.add(a);
    const removeB = ticker.add(b);
    expect(raf).toHaveBeenCalledTimes(1);
    (pending as unknown as FrameRequestCallback)(1000);
    (pending as unknown as FrameRequestCallback)(5000);
    expect(a).toHaveBeenLastCalledWith(100, 5000);
    removeA();
    removeB();
    expect(caf).toHaveBeenCalled();
    expect(ticker.running).toBe(false);
  });
});
