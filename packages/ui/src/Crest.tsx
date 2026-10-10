import { cx } from './cx.ts';
import './crest.css';

export interface CrestProps {
  /** Rendered size in CSS units. Default 2.5rem. */
  size?: string;
  /** When set, the crest is informative (role="img"); otherwise it is decorative. */
  label?: string;
  className?: string;
}

/** The bar's crest: concentric rings around a single leaf. Inherits `color`. */
export function Crest({ size = '2.5rem', label, className }: CrestProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      className={cx('bar-crest', className)}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      focusable="false"
      {...a11y}
    >
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="32" cy="32" r="21.5" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <g transform="rotate(-35 32 32)">
        <path
          d="M32 15 C42 22 42 40 32 49 C22 40 22 22 32 15 Z"
          fill="currentColor"
          className="bar-crest__leaf"
        />
        <path d="M32 19 L32 47" stroke="var(--crest-vein, var(--room-bg))" strokeWidth="1" />
      </g>
    </svg>
  );
}
