import {
  $snapshotStatus,
  StationBoundary,
  useInView,
  useMotion,
  useRoomStore,
  useStationLifecycle,
} from '@bar/room';
import { useRef, useState } from 'react';
import type { Weather } from './store.ts';
import { $weather, isWet, statusLine } from './store.ts';

function Plants() {
  return (
    <svg className="window__plants" viewBox="0 0 320 90" aria-hidden="true" focusable="false">
      {/* Trailing pothos in a cream pot. */}
      <g transform="translate(40 0)">
        <path className="window__leaf" d="M30 46 C10 40 4 22 14 12 C26 20 32 32 30 46 Z" />
        <path
          className="window__leaf window__leaf--deep"
          d="M34 44 C44 26 60 20 70 26 C62 40 48 46 34 44 Z"
        />
        <path className="window__leaf" d="M28 50 C12 56 4 70 8 84 C20 76 28 64 28 50 Z" />
        <path className="window__stem" d="M32 52 C40 66 52 74 62 88" />
        <path
          className="window__leaf window__leaf--deep"
          d="M58 80 C66 70 78 70 84 76 C78 84 68 86 58 80 Z"
        />
        <rect
          className="window__pot window__pot--paper"
          x="14"
          y="46"
          width="36"
          height="34"
          rx="4"
        />
      </g>
      {/* Snake plant in a teak pot. */}
      <g transform="translate(180 0)">
        <path
          className="window__leaf window__leaf--deep"
          d="M30 56 C26 36 26 18 32 4 C36 20 36 38 34 56 Z"
        />
        <path className="window__leaf" d="M38 56 C40 38 46 22 56 12 C54 30 48 44 44 56 Z" />
        <path className="window__leaf" d="M24 56 C18 42 12 32 4 26 C10 40 16 50 20 58 Z" />
        <path className="window__pot window__pot--wood" d="M10 54 H58 L52 86 H16 Z" />
      </g>
      {/* A small succulent. */}
      <g transform="translate(270 40)">
        <path className="window__leaf" d="M14 22 C6 14 8 4 14 0 C20 4 22 14 14 22 Z" />
        <path
          className="window__leaf window__leaf--deep"
          d="M14 22 C4 22 0 14 2 8 C10 10 14 16 14 22 Z"
        />
        <path
          className="window__leaf window__leaf--deep"
          d="M14 22 C24 22 28 14 26 8 C18 10 14 16 14 22 Z"
        />
        <rect
          className="window__pot window__pot--paper"
          x="2"
          y="22"
          width="24"
          height="24"
          rx="3"
        />
      </g>
    </svg>
  );
}

function View({
  weather,
  raining,
  animate,
}: {
  weather: Weather | undefined;
  raining: boolean;
  animate: boolean;
}) {
  return (
    <figure className="window" data-condition={weather?.condition}>
      <div className="window__frame">
        <div className="window__glass">
          <div className="window__sky" />
          <div className="window__glow" />
          <div
            className="window__rain"
            data-raining={raining || undefined}
            data-animate={animate || undefined}
          >
            <div className="window__streaks" />
            <div className="window__streaks window__streaks--far" />
          </div>
          <div className="window__shoji" />
        </div>
      </div>
      <div className="window__sill">
        <Plants />
      </div>
      <figcaption className="window__status" aria-live="polite">
        {statusLine(weather)}
      </figcaption>
    </figure>
  );
}

function Live() {
  const weather = useRoomStore($weather);
  useRoomStore($snapshotStatus);
  const motion = useMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [entered, setEntered] = useState(false);
  useStationLifecycle({
    onEnter: () => {
      setEntered(true);
    },
    onLeave: () => {
      setEntered(false);
    },
  });
  const raining = isWet(weather);
  return (
    <div ref={ref}>
      <View weather={weather} raining={raining} animate={raining && motion && inView && entered} />
    </div>
  );
}

export default function Window() {
  return (
    <StationBoundary
      station="window"
      fallback={<View weather={undefined} raining={false} animate={false} />}
    >
      <Live />
    </StationBoundary>
  );
}
