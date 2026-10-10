import { cx } from './cx.ts';
import './status-dot.css';

/** Release statuses (Workshop) and the shop sign's open/closed state. */
export const DOT_STATUSES = ['demo', 'studio', 'pressed', 'out', 'open', 'closed'] as const;
export type DotStatus = (typeof DOT_STATUSES)[number];

export interface StatusDotProps {
  status: DotStatus;
  className?: string;
}

/** A small colored dot. Decorative: always pair it with a visible text label. */
export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span className={cx('bar-status-dot', className)} data-status={status} aria-hidden="true" />
  );
}
