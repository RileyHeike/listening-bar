import type { ProjectStatus } from '@bar/content';
import { StationBoundary, useMotion } from '@bar/room';
import { Cassette, PillButton, Sleeve } from '@bar/ui';
import { LazyMotion, m } from 'motion/react';
import { useState } from 'react';

export interface ShelfItem {
  slug: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  year: number;
  catalog: string;
}

interface Props {
  items: ShelfItem[];
  filters: { status: ProjectStatus; label: string }[];
}

type Filter = ProjectStatus | 'all';

const loadFeatures = () => import('./motion-features.ts').then((module) => module.default);
const transitionName = (slug: string) => `project-${slug}`;

/** A demo tape is a cassette; out of print is a faded sleeve; everything else a sleeve. */
function Item({ item }: { item: ShelfItem }) {
  const href = `/workshop/${item.slug}`;
  if (item.status === 'demo') {
    return (
      <a className="shelf__tape" href={href}>
        <Cassette
          label={item.title}
          sublabel={`Demo · ${item.year}`}
          transitionName={transitionName(item.slug)}
        />
        <span className="shelf__tape-summary">{item.summary}</span>
      </a>
    );
  }
  return (
    <Sleeve
      name={item.title}
      blurb={item.summary}
      href={href}
      seed={item.slug}
      kicker={`${item.catalog} · ${item.year}`}
      transitionName={transitionName(item.slug)}
      faded={item.status === 'out'}
    />
  );
}

function View({
  items,
  filters,
  filter,
  onFilter,
  animate,
}: Props & {
  filter: Filter;
  onFilter?: (filter: Filter) => void;
  animate: boolean;
}) {
  const visible = items.filter((item) => filter === 'all' || item.status === filter);
  const label = filter === 'all' ? 'All' : (filters.find((f) => f.status === filter)?.label ?? '');
  return (
    <>
      <div className="shelf__filters" role="group" aria-label="Filter by status">
        <PillButton
          pressed={filter === 'all'}
          disabled={!onFilter}
          onClick={() => onFilter?.('all')}
        >
          All
        </PillButton>
        {filters.map((f) => (
          <PillButton
            key={f.status}
            dot={f.status}
            pressed={filter === f.status}
            disabled={!onFilter}
            onClick={() => onFilter?.(f.status)}
          >
            {f.label}
          </PillButton>
        ))}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {label}: {visible.length} of {items.length} shown
      </p>
      <ul className="shelf__grid">
        {visible.map((item) => (
          <m.li
            key={item.slug}
            className="shelf__item"
            layout={animate}
            initial={false}
            transition={{ type: 'spring', stiffness: 170, damping: 24 }}
          >
            <Item item={item} />
          </m.li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="shelf__empty">Nothing on this shelf yet.</p> : null}
    </>
  );
}

function Live(props: Props) {
  const motion = useMotion();
  const [filter, setFilter] = useState<Filter>('all');
  return <View {...props} filter={filter} onFilter={setFilter} animate={motion} />;
}

export default function Shelf(props: Props) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <StationBoundary
        station="workshop-shelf"
        fallback={<View {...props} filter="all" animate={false} />}
      >
        <Live {...props} />
      </StationBoundary>
    </LazyMotion>
  );
}
