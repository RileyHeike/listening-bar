import { z } from 'zod';
import { defineEvent } from '../define.ts';

export const spinsUpdated = defineEvent({
  type: 'spins.updated',
  domain: 'music',
  kind: 'state',
  description: 'The "Recently spun" list changed (most recent first).',
  versions: {
    1: z.object({
      spins: z
        .array(
          z.object({
            title: z.string().min(1),
            artist: z.string().min(1),
            year: z.number().int().min(1800).max(2200).optional(),
          }),
        )
        .max(10),
    }),
  },
});
