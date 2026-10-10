/** Small line icons. Decorative: pair them with visible text. Inherit `color`. */

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function BulbIcon() {
  return (
    <svg {...common}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function SpeakerIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg {...common}>
      <path d="M4 10v4h3l4 4V6L7 10H4Z" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
      )}
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg {...common}>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}
