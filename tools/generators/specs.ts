/**
 * Generator specs: the flags each generator takes, in the order they are
 * passed to `turbo gen` as answers. Shared by the CLI (validation, usage)
 * and the plop config (prompts).
 */
export interface FlagSpec {
  name: string;
  description: string;
  required: boolean;
  /** Validates the raw value; returns an error message or null. */
  validate: (value: string) => string | null;
  defaultValue?: string;
}

/** Answer standing in for an empty optional flag (generators reject empty answers). */
export const EMPTY = '-';

const kebab = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const check = (ok: boolean, message: string) => (ok ? null : message);

export const generators: Record<string, { description: string; flags: FlagSpec[] }> = {
  station: {
    description: 'A station package (draft) with manifest, static shell, island, test.',
    flags: [
      {
        name: 'id',
        description: 'kebab-case station id, e.g. "tea-shelf"',
        required: true,
        validate: (v) => check(kebab.test(v), 'must be kebab-case'),
      },
      {
        name: 'name',
        description: 'Human name for the wall and nav, e.g. "Tea shelf"',
        required: true,
        validate: (v) => check(v.trim().length > 0 && v.length <= 40, 'must be 1-40 characters'),
      },
      {
        name: 'target',
        description: 'Slot to render into, "page:slot" (e.g. "room:wall")',
        required: true,
        validate: (v) =>
          check(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(v), 'must look like page:slot'),
      },
      {
        name: 'route',
        description: 'Route the station owns, e.g. "/tea" (adds a sleeve)',
        required: false,
        defaultValue: '',
        validate: (v) =>
          check(v === '' || /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(v), 'must look like /kebab-path'),
      },
      {
        name: 'hydrate',
        description: 'load | idle | visible | none',
        required: false,
        defaultValue: 'visible',
        validate: (v) =>
          check(
            ['load', 'idle', 'visible', 'none'].includes(v),
            'must be load, idle, visible or none',
          ),
      },
    ],
  },
  page: {
    description: 'An Astro page with definePage and a SlotOutlet per slot.',
    flags: [
      {
        name: 'id',
        description: 'kebab-case page id, e.g. "tea-room"',
        required: true,
        validate: (v) =>
          check(kebab.test(v) && v !== 'layout', 'must be kebab-case and not "layout"'),
      },
      {
        name: 'route',
        description: 'Route, e.g. "/tea-room" or "/notes/[slug]"',
        required: true,
        validate: (v) =>
          check(
            /^\/(([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\])(\/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\]))*)?$/.test(
              v,
            ),
            'must start with "/" and use kebab-case or [param] segments',
          ),
      },
      {
        name: 'slots',
        description: 'Comma-separated slot names, e.g. "intro,shelf"',
        required: true,
        validate: (v) =>
          check(
            v.split(',').every((s) => kebab.test(s)) &&
              new Set(v.split(',')).size === v.split(',').length,
            'must be unique kebab-case names separated by commas',
          ),
      },
    ],
  },
  event: {
    description: 'A registered event type (v1 schema), fixture, and test.',
    flags: [
      {
        name: 'type',
        description: '"subject.pastTenseVerb", e.g. "plant.watered"',
        required: true,
        validate: (v) =>
          check(
            /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/.test(v),
            'must look like subject.pastTenseVerb',
          ),
      },
      {
        name: 'domain',
        description: 'Channel namespace, e.g. "plants"',
        required: true,
        validate: (v) => check(kebab.test(v), 'must be kebab-case'),
      },
      {
        name: 'kind',
        description: 'state | moment',
        required: true,
        validate: (v) => check(v === 'state' || v === 'moment', 'must be state or moment'),
      },
    ],
  },
  module: {
    description: 'A back-end module package with manifest, example route, entities, test.',
    flags: [
      {
        name: 'name',
        description: 'kebab-case module name, mounted at /api/<name>',
        required: true,
        validate: (v) => check(kebab.test(v) && v !== 'room', 'must be kebab-case and not "room"'),
      },
    ],
  },
};
