import { cx } from './cx.ts';
import './fact-list.css';

export interface FactListProps {
  facts: readonly { label: string; value: string }[];
  className?: string | undefined;
}

/** Small label/value facts in mono, like pressing info on a record. */
export function FactList({ facts, className }: FactListProps) {
  return (
    <dl className={cx('bar-facts', className)}>
      {facts.map((fact) => (
        <div key={fact.label} className="bar-facts__row">
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
