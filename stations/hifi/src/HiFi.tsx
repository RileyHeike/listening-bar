import { SECONDS_PER_REVOLUTION_33 } from '@bar/core';
import {
  $snapshotStatus,
  StationBoundary,
  useInView,
  useMotion,
  useRoomStore,
  useStationLifecycle,
  useTicker,
} from '@bar/room';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import type { Spin, Track } from './store.ts';
import { $nowPlaying, $spins } from './store.ts';

/** Turntable geometry (SVG user units). */
const PLATTER = { x: 150, y: 150 };
const ARM = { x: 332, y: 58, playing: 31 };
const GROOVES = Array.from({ length: 11 }, (_, i) => 52 + i * 6);

/** Degrees per millisecond at a true 33⅓ RPM (1.8 s per revolution). */
const SPEED_33 = 360 / (SECONDS_PER_REVOLUTION_33 * 1000);
/** Inertia: time constants for spinning up and coasting down. */
const SPIN_UP_MS = 450;
const SPIN_DOWN_MS = 1400;

type Phase = 'pending' | 'playing' | 'idle';

interface ViewProps {
  phase: Phase;
  track: Track | null | undefined;
  spins: readonly Spin[] | undefined;
  recordRef?: RefObject<SVGGElement | null>;
  needleRefs?: [RefObject<SVGLineElement | null>, RefObject<SVGLineElement | null>];
}

function Turntable({ phase, recordRef }: Pick<ViewProps, 'phase' | 'recordRef'>) {
  return (
    <svg className="hifi__deck" viewBox="0 0 400 300" aria-hidden="true" focusable="false">
      <rect className="hifi__plinth" x="6" y="6" width="388" height="288" rx="14" />
      <rect className="hifi__plinth-top" x="16" y="16" width="368" height="268" rx="9" />
      <circle className="hifi__platter" cx={PLATTER.x} cy={PLATTER.y} r="124" />
      <g ref={recordRef} className="hifi__record">
        <circle className="hifi__vinyl" cx={PLATTER.x} cy={PLATTER.y} r="118" />
        {GROOVES.map((r) => (
          <circle key={r} className="hifi__groove" cx={PLATTER.x} cy={PLATTER.y} r={r} />
        ))}
        <circle className="hifi__label" cx={PLATTER.x} cy={PLATTER.y} r="38" />
        <rect
          className="hifi__label-mark"
          x={PLATTER.x - 22}
          y={PLATTER.y - 20}
          width="44"
          height="5"
          rx="2"
        />
        <rect
          className="hifi__label-mark"
          x={PLATTER.x - 14}
          y={PLATTER.y + 14}
          width="28"
          height="3"
          rx="1.5"
        />
      </g>
      {/* The light catches the same spot while the record turns underneath. */}
      <path
        className="hifi__sheen"
        d={`M ${PLATTER.x - 100} ${PLATTER.y - 60} A 116 116 0 0 1 ${PLATTER.x - 30} ${PLATTER.y - 112}`}
      />
      <circle className="hifi__spindle" cx={PLATTER.x} cy={PLATTER.y} r="3.5" />
      <rect className="hifi__rest" x={ARM.x - 7} y="228" width="14" height="10" rx="2" />
      <g className="hifi__arm" data-on-record={phase === 'playing' || undefined}>
        <line className="hifi__arm-tube" x1={ARM.x} y1={ARM.y} x2={ARM.x} y2="214" />
        <rect className="hifi__headshell" x={ARM.x - 8} y="206" width="16" height="24" rx="3" />
        <line className="hifi__counterweight" x1={ARM.x} y1={ARM.y} x2={ARM.x} y2="30" />
      </g>
      <circle className="hifi__pivot" cx={ARM.x} cy={ARM.y} r="15" />
      <circle className="hifi__pivot-cap" cx={ARM.x} cy={ARM.y} r="6" />
      <g className="hifi__speed">
        <circle
          className="hifi__speed-light"
          cx="300"
          cy="266"
          r="4"
          data-lit={phase === 'playing' || undefined}
        />
        <text className="hifi__speed-text" x="312" y="270">
          33⅓
        </text>
      </g>
    </svg>
  );
}

function VuMeter({
  channel,
  needleRef,
}: {
  channel: 'L' | 'R';
  needleRef?: RefObject<SVGLineElement | null>;
}) {
  // Scale arc around a pivot below the face; the red zone is the last stretch.
  const pivot = { x: 80, y: 104 };
  const arc = (from: number, to: number, r: number) => {
    const point = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return `${(pivot.x + r * Math.cos(rad)).toFixed(2)} ${(pivot.y + r * Math.sin(rad)).toFixed(2)}`;
    };
    return `M ${point(from)} A ${r} ${r} 0 0 1 ${point(to)}`;
  };
  return (
    <svg className="hifi__vu" viewBox="0 0 160 100" aria-hidden="true" focusable="false">
      <rect className="hifi__vu-face" x="2" y="2" width="156" height="96" rx="6" />
      <path className="hifi__vu-scale" d={arc(-48, 26, 70)} />
      <path className="hifi__vu-red" d={arc(26, 48, 70)} />
      {[-48, -30, -12, 6, 26, 37, 48].map((deg) => (
        <path
          key={deg}
          className="hifi__vu-tick"
          d={`${arc(deg, deg + 0.01, 70)} L ${pivot.x} ${pivot.y}`}
        />
      ))}
      <rect className="hifi__vu-mask" x="10" y="40" width="140" height="56" />
      <text className="hifi__vu-label" x="80" y="70">
        VU
      </text>
      <text className="hifi__vu-channel" x="16" y="88">
        {channel}
      </text>
      <line
        ref={needleRef}
        className="hifi__vu-needle"
        x1={pivot.x}
        y1={pivot.y}
        x2={pivot.x}
        y2={pivot.y - 78}
        style={{ transform: 'rotate(-48deg)' }}
      />
      <circle className="hifi__vu-pivot" cx={pivot.x} cy="96" r="5" />
    </svg>
  );
}

function NowSpinning({ phase, track }: Pick<ViewProps, 'phase' | 'track'>) {
  if (phase === 'pending' || track === undefined) {
    return (
      <div className="hifi__now" data-state="pending">
        <p className="hifi__kicker">Now spinning</p>
        <p className="hifi__title">Tuning in…</p>
        <p className="hifi__artist">&nbsp;</p>
        <p className="hifi__meta">&nbsp;</p>
      </div>
    );
  }
  if (track === null) {
    return (
      <div className="hifi__now" data-state="idle">
        <p className="hifi__kicker">The needle is resting</p>
        <p className="hifi__title">Between records</p>
        <p className="hifi__artist">Something good is coming up.</p>
        <p className="hifi__meta">&nbsp;</p>
      </div>
    );
  }
  const position = [
    track.side ? `Side ${track.side}` : null,
    track.track ? `track ${track.track}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="hifi__now" data-state="playing" aria-live="polite">
      <p className="hifi__kicker">Now spinning</p>
      <p className="hifi__title">{track.title}</p>
      <p className="hifi__artist">
        {track.artist}
        {track.year ? ` · ${track.year}` : ''}
      </p>
      <p className="hifi__meta">{[track.source, position].filter(Boolean).join(' · ')}</p>
    </div>
  );
}

const RECENT_ROWS = 4;

function RecentlySpun({ spins }: Pick<ViewProps, 'spins'>) {
  const rows = spins?.slice(0, RECENT_ROWS) ?? [];
  return (
    <div className="hifi__recent">
      <h3 className="hifi__recent-title">Recently spun</h3>
      <ol className="hifi__recent-list">
        {Array.from({ length: RECENT_ROWS }, (_, index) => {
          const spin = rows[index];
          if (!spin) {
            return (
              <li key={index} className="hifi__recent-row" data-empty="">
                {spins === undefined ? '' : index === 0 ? 'Nothing yet tonight.' : ''}
              </li>
            );
          }
          return (
            <li key={index} className="hifi__recent-row">
              <span className="hifi__recent-name">{spin.title}</span>
              <span className="hifi__recent-artist">
                {spin.artist}
                {spin.year ? ` · ${spin.year}` : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function View({ phase, track, spins, recordRef, needleRefs }: ViewProps) {
  return (
    <div className="hifi__console" data-phase={phase}>
      <Turntable phase={phase} recordRef={recordRef} />
      <div className="hifi__panel">
        <NowSpinning phase={phase} track={track} />
        <div className="hifi__meters">
          <VuMeter channel="L" needleRef={needleRefs?.[0]} />
          <VuMeter channel="R" needleRef={needleRefs?.[1]} />
        </div>
        <RecentlySpun spins={spins} />
      </div>
    </div>
  );
}

/** Smooth pseudo-random level in [0, 1] for the VU needles. */
const level = (time: number, seed: number) =>
  0.55 +
  0.18 * Math.sin(time / 310 + seed) +
  0.12 * Math.sin(time / 97 + seed * 3) +
  0.08 * Math.sin(time / 53 + seed * 7);

function Live() {
  const track = useRoomStore($nowPlaying);
  const spins = useRoomStore($spins);
  const snapshot = useRoomStore($snapshotStatus);
  const motion = useMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const recordRef = useRef<SVGGElement>(null);
  const needleL = useRef<SVGLineElement>(null);
  const needleR = useRef<SVGLineElement>(null);
  const physics = useRef({ angle: 0, velocity: 0, levels: [0, 0] });
  const [entered, setEntered] = useState(false);
  const [moving, setMoving] = useState(false);
  const inView = useInView(rootRef, '100px');

  const known = track !== undefined || snapshot === 'ready' || snapshot === 'error';
  const phase: Phase = !known ? 'pending' : track ? 'playing' : 'idle';
  const playing = phase === 'playing';

  useStationLifecycle({
    onEnter: () => {
      setEntered(true);
    },
    onLeave: () => {
      setEntered(false);
    },
  });

  // Ambient motion runs only when it can be seen, and only while there is motion to show.
  const active = entered && inView && motion && (playing || moving);
  if (playing && !moving && motion) setMoving(true);

  useTicker((delta, time) => {
    const state = physics.current;
    const target = playing ? SPEED_33 : 0;
    const tau = target > state.velocity ? SPIN_UP_MS : SPIN_DOWN_MS;
    state.velocity += (target - state.velocity) * (1 - Math.exp(-delta / tau));
    if (state.velocity < 0.00002 && !playing) state.velocity = 0;
    state.angle = (state.angle + state.velocity * delta) % 360;
    recordRef.current?.style.setProperty('transform', `rotate(${state.angle.toFixed(2)}deg)`);

    [needleL, needleR].forEach((needle, i) => {
      const goal = playing ? Math.min(1, level(time, i * 1.7)) : 0;
      const current = state.levels[i] ?? 0;
      const next = current + (goal - current) * (1 - Math.exp(-delta / 90));
      state.levels[i] = next;
      needle.current?.style.setProperty('transform', `rotate(${(-48 + next * 96).toFixed(2)}deg)`);
    });

    const resting = state.velocity === 0 && state.levels.every((l) => l < 0.001);
    if (resting && !playing) setMoving(false);
  }, active);

  return (
    <div ref={rootRef}>
      <View
        phase={phase}
        track={track}
        spins={spins}
        recordRef={recordRef}
        needleRefs={[needleL, needleR]}
      />
    </div>
  );
}

export default function HiFi() {
  return (
    <StationBoundary
      station="hifi"
      fallback={<View phase="pending" track={undefined} spins={undefined} />}
    >
      <Live />
    </StationBoundary>
  );
}
