import type { CSSProperties } from 'react';
import { cx } from './cx.ts';
import { SleeveArt } from './SleeveArt.tsx';
import './sleeve.css';

export interface SleeveProps {
  name: string;
  blurb?: string | undefined;
  /** Destination; the whole sleeve becomes one link. */
  href?: string | undefined;
  /** Cover image URL. Without it, deterministic geometric art is drawn from `seed`. */
  src?: string | undefined;
  /** Seed for generated art; defaults to `name`. */
  seed?: string | undefined;
  /**
   * view-transition-name for the cover, shared with the destination's hero so
   * the sleeve morphs into it on navigation.
   */
  transitionName?: string | undefined;
  /** Out-of-print look: desaturated and faded. */
  faded?: boolean | undefined;
  /** Small mono line above the name, e.g. a catalog number. */
  kicker?: string | undefined;
  className?: string | undefined;
}

/** A record sleeve: square cover, name and blurb. Hover or focus pulls it off the shelf. */
export function Sleeve({
  name,
  blurb,
  href,
  src,
  seed,
  transitionName,
  faded = false,
  kicker,
  className,
}: SleeveProps) {
  const coverStyle: CSSProperties | undefined = transitionName
    ? { viewTransitionName: transitionName }
    : undefined;
  const body = (
    <>
      <span className="bar-sleeve__cover" style={coverStyle}>
        {src ? (
          <img src={src} alt="" width={600} height={600} loading="lazy" decoding="async" />
        ) : (
          <SleeveArt seed={seed ?? name} />
        )}
      </span>
      <span className="bar-sleeve__text">
        {kicker ? <span className="bar-sleeve__kicker">{kicker}</span> : null}
        <span className="bar-sleeve__name">{name}</span>
        {blurb ? <span className="bar-sleeve__blurb">{blurb}</span> : null}
      </span>
    </>
  );
  return (
    <div className={cx('bar-sleeve', className)} data-faded={faded || undefined}>
      {href ? (
        <a className="bar-sleeve__body" href={href}>
          {body}
        </a>
      ) : (
        <div className="bar-sleeve__body">{body}</div>
      )}
    </div>
  );
}
