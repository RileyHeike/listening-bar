import { StationBoundary, claimEntrance, useMotion } from '@bar/room';
import { Crest } from '@bar/ui';
import type { Ref } from 'react';
import { useEffect, useRef } from 'react';

const PANELS = [0, 1, 2, 3] as const;

/**
 * The doorway curtain. Four fabric panels on a rod; the crest is split across
 * the middle gap, half on each center panel, so it parts with the fabric.
 */
function Curtain({ curtainRef }: { curtainRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={curtainRef} className="noren" aria-hidden="true">
      <div className="noren__rod" />
      <div className="noren__panels">
        {PANELS.map((index) => (
          <div key={index} className="noren__panel" data-panel={index}>
            {index === 1 || index === 2 ? (
              <span className="noren__crest" data-half={index === 1 ? 'left' : 'right'}>
                <Crest size="100%" />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Live() {
  const motion = useMotion();
  const curtainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Entrance motion: once per session, as if the visitor just walked through.
    // Set directly on the element so the server-rendered markup stays at rest.
    if (motion && claimEntrance('noren')) curtainRef.current?.setAttribute('data-entering', '');
  }, [motion]);

  return <Curtain curtainRef={curtainRef} />;
}

export default function Noren() {
  return (
    <StationBoundary station="noren" fallback={<Curtain />}>
      <Live />
    </StationBoundary>
  );
}
