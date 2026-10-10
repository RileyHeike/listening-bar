import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import type { DotStatus } from './StatusDot.tsx';
import { StatusDot } from './StatusDot.tsx';
import './pill.css';

interface PillContentProps {
  /** Optional status dot before the label. */
  dot?: DotStatus;
  children: ReactNode;
}

function PillContent({ dot, children }: PillContentProps) {
  return (
    <>
      {dot ? <StatusDot status={dot} /> : null}
      <span>{children}</span>
    </>
  );
}

export interface PillProps extends PillContentProps {
  className?: string;
}

/** A static rounded label, e.g. the open sign or an availability note. */
export function Pill({ dot, children, className }: PillProps) {
  return (
    <span className={cx('bar-pill', className)}>
      <PillContent dot={dot}>{children}</PillContent>
    </span>
  );
}

export interface PillButtonProps
  extends PillContentProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  pressed: boolean;
}

/** A toggle pill (aria-pressed), e.g. a shelf filter. */
export function PillButton({ dot, children, pressed, className, ...rest }: PillButtonProps) {
  return (
    <button
      type="button"
      className={cx('bar-pill', 'bar-pill--button', className)}
      aria-pressed={pressed}
      {...rest}
    >
      <PillContent dot={dot}>{children}</PillContent>
    </button>
  );
}
