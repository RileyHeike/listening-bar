import { StationBoundary } from '@bar/room';
import { Crest } from '@bar/ui';
import { useState } from 'react';

interface Props {
  name: string;
  title: string;
  lines: string[];
  back: string;
}

function Card({
  name,
  title,
  lines,
  back,
  flipped,
  onFlip,
}: Props & { flipped: boolean; onFlip?: () => void }) {
  return (
    <div className="meishi" data-flipped={flipped || undefined}>
      <div className="meishi__inner">
        <div className="meishi__face meishi__face--front" aria-hidden={flipped}>
          <Crest size="2.5rem" />
          <p className="meishi__name">{name}</p>
          <p className="meishi__title">{title}</p>
          <ul className="meishi__lines">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="meishi__face meishi__face--back" aria-hidden={!flipped}>
          <Crest size="4rem" />
          <p className="meishi__back">{back}</p>
        </div>
      </div>
      <button
        type="button"
        className="meishi__flip"
        aria-pressed={flipped}
        disabled={!onFlip}
        onClick={onFlip}
      >
        {flipped ? 'Turn the card back' : 'Turn the card over'}
      </button>
    </div>
  );
}

function Live(props: Props) {
  const [flipped, setFlipped] = useState(false);
  return (
    <Card
      {...props}
      flipped={flipped}
      onFlip={() => {
        setFlipped((value) => !value);
      }}
    />
  );
}

export default function Meishi(props: Props) {
  return (
    <StationBoundary station="liner-intro" fallback={<Card {...props} flipped={false} />}>
      <Live {...props} />
    </StationBoundary>
  );
}
