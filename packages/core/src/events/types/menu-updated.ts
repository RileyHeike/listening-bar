import { z } from 'zod';
import { defineEvent } from '../define.ts';

/** Chalkboard rows, in display order. */
export const MENU_ROWS = [
  'onRotation',
  'reading',
  'growing',
  'learning',
  'building',
  'drinking',
] as const;

export const menuUpdated = defineEvent({
  type: 'menu.updated',
  domain: 'menu',
  kind: 'state',
  description: "Tonight's menu on the chalkboard changed.",
  versions: {
    1: z.object(
      Object.fromEntries(MENU_ROWS.map((row) => [row, z.string().min(1).max(60)])) as Record<
        (typeof MENU_ROWS)[number],
        z.ZodString
      >,
    ),
  },
});
