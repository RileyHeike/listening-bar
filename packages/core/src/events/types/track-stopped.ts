import { z } from 'zod';
import { defineEvent } from '../define.ts';

export const trackStopped = defineEvent({
  type: 'track.stopped',
  domain: 'music',
  kind: 'state',
  description: 'The hi-fi stopped playing; the room is between records.',
  versions: {
    1: z.object({}),
  },
});
