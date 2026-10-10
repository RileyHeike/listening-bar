import { z } from 'zod';
import { defineEvent } from '../define.ts';

export const trackChanged = defineEvent({
  type: 'track.changed',
  domain: 'music',
  kind: 'state',
  description: 'A new track started playing on the hi-fi.',
  versions: {
    1: z.object({
      /** Where the music is coming from, e.g. "Turntable". */
      source: z.string().min(1),
      title: z.string().min(1),
      artist: z.string().min(1),
      year: z.number().int().min(1800).max(2200).optional(),
      /** Record side, e.g. "A". */
      side: z.string().min(1).max(2).optional(),
      /** Track number on the side. */
      track: z.number().int().positive().optional(),
    }),
  },
});
