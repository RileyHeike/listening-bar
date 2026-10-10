import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import './button.css';

type Variant = 'solid' | 'outline' | 'quiet';

interface CommonProps {
  variant?: Variant;
  /** Decorative icon shown before the label. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export type ButtonProps = CommonProps &
  (
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps>)
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>)
  );

/** A real <button>, or a link styled as one when `href` is set. */
export function Button({ variant = 'solid', icon, children, className, ...rest }: ButtonProps) {
  const classes = cx('bar-button', className);
  const content = (
    <>
      {icon ? (
        <span className="bar-button__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </>
  );
  if (rest.href !== undefined) {
    return (
      <a className={classes} data-variant={variant} {...rest}>
        {content}
      </a>
    );
  }
  const { type = 'button', ...buttonRest } = rest;
  return (
    <button className={classes} data-variant={variant} type={type} {...buttonRest}>
      {content}
    </button>
  );
}
