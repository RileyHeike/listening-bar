import { cx } from './cx.ts';
import './tracklist.css';

export interface Track {
  title: string;
  /** "YYYY-MM" */
  date?: string | undefined;
  done: boolean;
}

export interface TracklistProps {
  tracks: readonly Track[];
  className?: string | undefined;
}

const formatDate = (date: string) => {
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** Milestones as an album tracklist: numbered, with dates; unfinished ones marked. */
export function Tracklist({ tracks, className }: TracklistProps) {
  return (
    <ol className={cx('bar-tracklist', className)}>
      {tracks.map((track, index) => (
        <li key={`${index}-${track.title}`} className="bar-tracklist__track" data-done={track.done}>
          <span className="bar-tracklist__number">{String(index + 1).padStart(2, '0')}</span>
          <span className="bar-tracklist__title">{track.title}</span>
          <span className="bar-tracklist__meta">
            {track.date ? <time dateTime={track.date}>{formatDate(track.date)}</time> : null}
            {track.done ? null : <span className="bar-tracklist__pending">In progress</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
