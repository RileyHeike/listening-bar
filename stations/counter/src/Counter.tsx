import type { Side } from '@bar/room';
import { $side, StationBoundary, setSide, useRoomStore } from '@bar/room';
import { Button } from '@bar/ui';

interface SideContent {
  kicker: string;
  headline: string;
  body: string;
  actions: { label: string; href: string }[];
}

interface Props {
  sides: Record<Side, SideContent>;
}

const SIDES: Side[] = ['A', 'B'];

/**
 * Both sides render, stacked in one grid cell, so the counter never changes
 * height. Which side shows is driven by <html data-side>, set before paint
 * from the visitor's saved choice; the toggle only updates the store.
 */
function Sides({ sides, active, interactive }: Props & { active: Side; interactive: boolean }) {
  return (
    <>
      <div className="counter__toggle" role="group" aria-label="Record side">
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            className="counter__side-button"
            data-side={side}
            aria-pressed={active === side}
            disabled={!interactive}
            onClick={() => {
              setSide(side);
            }}
          >
            Side {side}
          </button>
        ))}
      </div>
      <div className="counter__record">
        {SIDES.map((side) => (
          <article key={side} className="counter__face" data-face={side}>
            <p className="counter__kicker">{sides[side].kicker}</p>
            <h2 className="counter__headline">{sides[side].headline}</h2>
            <p className="counter__body">{sides[side].body}</p>
            <div className="counter__actions">
              {sides[side].actions.map((action, index) => (
                <Button
                  key={action.href}
                  href={action.href}
                  variant={index === 0 ? 'solid' : 'outline'}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Live({ sides }: Props) {
  const active = useRoomStore($side);
  return <Sides sides={sides} active={active} interactive />;
}

export default function Counter({ sides }: Props) {
  return (
    <StationBoundary
      station="counter"
      fallback={<Sides sides={sides} active="A" interactive={false} />}
    >
      <Live sides={sides} />
    </StationBoundary>
  );
}
