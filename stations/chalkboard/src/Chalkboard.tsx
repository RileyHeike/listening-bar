import { MENU_ROWS } from '@bar/core';
import { StationBoundary, useRoomStore } from '@bar/room';
import type { Menu } from './store.ts';
import { $menu } from './store.ts';

const LABELS: Record<(typeof MENU_ROWS)[number], string> = {
  onRotation: 'On rotation',
  reading: 'Reading',
  growing: 'Growing',
  learning: 'Learning',
  building: 'Building',
  drinking: 'Drinking',
};

function Rows({ menu }: { menu: Menu }) {
  return (
    <dl className="chalkboard__rows">
      {MENU_ROWS.map((row) => (
        <div key={row} className="chalkboard__row">
          <dt>{LABELS[row]}</dt>
          {/* Keyed by value so a change re-runs the chalk-in transition. */}
          <dd key={menu[row]}>{menu[row]}</dd>
        </div>
      ))}
    </dl>
  );
}

function Live({ seed }: { seed: Menu }) {
  const live = useRoomStore($menu);
  return <Rows menu={live ?? seed} />;
}

export default function Chalkboard({ seed }: { seed: Menu }) {
  return (
    <StationBoundary station="chalkboard" fallback={<Rows menu={seed} />}>
      <Live seed={seed} />
    </StationBoundary>
  );
}
