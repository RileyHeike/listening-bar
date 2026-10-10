import { z } from 'zod';
import { defineEvent } from '../define.ts';

export const WEATHER_CONDITIONS = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'] as const;

export const weatherChanged = defineEvent({
  type: 'weather.changed',
  domain: 'weather',
  kind: 'state',
  description: 'The weather outside the window changed.',
  versions: {
    1: z.object({
      condition: z.enum(WEATHER_CONDITIONS),
      temperatureC: z.number().min(-90).max(60).optional(),
      /** Short human line for the status under the window. */
      summary: z.string().max(80).optional(),
    }),
  },
});
