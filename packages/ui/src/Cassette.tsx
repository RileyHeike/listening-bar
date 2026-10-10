import type { CSSProperties } from 'react';
import { cx } from './cx.ts';
import './cassette.css';

export interface CassetteProps {
  /** Handwritten-style label on the tape. */
  label: string;
  /** Small line under the label, e.g. "Demo · 2026". */
  sublabel?: string | undefined;
  transitionName?: string | undefined;
  className?: string | undefined;
}

/** A demo tape. The label is real text; the shell is decorative. */
export function Cassette({ label, sublabel, transitionName, className }: CassetteProps) {
  const style: CSSProperties | undefined = transitionName
    ? { viewTransitionName: transitionName }
    : undefined;
  return (
    <div className={cx('bar-cassette', className)} style={style}>
      <div className="bar-cassette__label">
        <span className="bar-cassette__title">{label}</span>
        {sublabel ? <span className="bar-cassette__sub">{sublabel}</span> : null}
      </div>
      <svg
        className="bar-cassette__window"
        viewBox="0 0 120 34"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="1" y="1" width="118" height="32" rx="16" className="bar-cassette__glass" />
        {[30, 90].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="17" r="11" className="bar-cassette__reel" />
            <circle cx={cx} cy="17" r="4" className="bar-cassette__hub" />
          </g>
        ))}
        <rect x="44" y="12" width="32" height="10" className="bar-cassette__tape" />
      </svg>
      <div className="bar-cassette__foot" aria-hidden="true" />
    </div>
  );
}
