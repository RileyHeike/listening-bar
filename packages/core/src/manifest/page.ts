import { z } from 'zod';
import { PageRouteSchema, kebabCase, parseOrThrow, unique } from './common.ts';

/** `room` pages follow the lighting phase; `paper` pages are daylight reading rooms. */
export const PAGE_TONES = ['room', 'paper'] as const;
export type PageTone = (typeof PAGE_TONES)[number];

export const LAYOUT_ID = 'layout';

const slotsSchema = z
  .array(kebabCase('Slot names'))
  .min(1)
  .refine(unique, 'Slot names must be unique.');

export const PageDefinitionSchema = z
  .object({
    id: kebabCase('Page id').refine((id) => id !== LAYOUT_ID, `"${LAYOUT_ID}" is reserved.`),
    route: PageRouteSchema,
    /** Human title, used in <title>. */
    title: z.string().min(1),
    slots: slotsSchema,
    tone: z.enum(PAGE_TONES).default('room'),
  })
  .strict();

export const LayoutDefinitionSchema = z
  .object({
    id: z.literal(LAYOUT_ID),
    slots: slotsSchema,
  })
  .strict();

export type PageDefinition = z.output<typeof PageDefinitionSchema>;
export type PageDefinitionInput = z.input<typeof PageDefinitionSchema>;
export type LayoutDefinition = z.output<typeof LayoutDefinitionSchema>;

/** Declare a page and its slots. Stations target slots as "<page id>:<slot>". */
export function definePage(input: PageDefinitionInput): PageDefinition {
  return parseOrThrow(PageDefinitionSchema, input, `Page "${input.id}"`);
}

/** Declare the base layout's slots. Stations target them as "layout:<slot>". */
export function defineLayout(input: { slots: string[] }): LayoutDefinition {
  return parseOrThrow(LayoutDefinitionSchema, { id: LAYOUT_ID, ...input }, 'Layout');
}
