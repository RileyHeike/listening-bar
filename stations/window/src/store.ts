import type { EventData } from '@bar/core';
import { createRoomStore } from '@bar/room';

export type Weather = EventData<'weather.changed'>;

/** The weather outside; undefined until known. */
export const $weather = createRoomStore<Weather | undefined>(undefined, {
  'weather.changed': (_, envelope) => envelope.data,
});

const CONDITION_LINES: Record<Weather['condition'], string> = {
  clear: 'Clear outside',
  cloudy: 'Clouds drifting by',
  rain: 'Rain on the glass',
  snow: 'Snow falling',
  fog: 'Fog on the street',
  storm: 'A storm rolling through',
};

/** The small status line under the window. */
export function statusLine(weather: Weather | undefined): string {
  if (!weather) return 'Looking outside…';
  const line = weather.summary ?? CONDITION_LINES[weather.condition];
  return weather.temperatureC === undefined
    ? line
    : `${line} · ${Math.round(weather.temperatureC)}°C`;
}

export const isWet = (weather: Weather | undefined) =>
  weather?.condition === 'rain' || weather?.condition === 'storm';
