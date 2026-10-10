import { $lights, $open, StationBoundary, toggleLights, useRoomStore } from '@bar/room';
import { BulbIcon, Button, Pill } from '@bar/ui';

interface Props {
  /** Opening hours, e.g. "12pm–2am". */
  hours: string;
}

/** Before the clock runs (and without JS): the hours, no open/closed claim. */
function Shell({ hours }: Props) {
  return (
    <div className="site-header__controls">
      <Pill className="site-header__sign-pill">Open {hours}</Pill>
    </div>
  );
}

function Live({ hours }: Props) {
  const open = useRoomStore($open);
  const lights = useRoomStore($lights);
  const up = lights === 'up';
  return (
    <div className="site-header__controls">
      <span title={`Open ${hours}, the owner's time`}>
        {open === null ? (
          <Pill className="site-header__sign-pill">Open {hours}</Pill>
        ) : (
          <Pill className="site-header__sign-pill" dot={open ? 'open' : 'closed'}>
            {open ? 'Open' : 'Closed'}
          </Pill>
        )}
      </span>
      <Button variant="quiet" icon={<BulbIcon />} aria-pressed={up} onClick={toggleLights}>
        {up ? 'Lights down' : 'Lights up'}
      </Button>
    </div>
  );
}

export default function HeaderControls(props: Props) {
  return (
    <StationBoundary station="site-header" fallback={<Shell {...props} />}>
      <Live {...props} />
    </StationBoundary>
  );
}
