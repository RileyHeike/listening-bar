import { z } from 'zod';

/**
 * `state` events hold the latest value of something (latest wins; included
 * in the snapshot). `moment` events are fire-and-forget and never replayed.
 */
export type EventKind = 'state' | 'moment';

/** Schemas for each supported version of an event's `data`, keyed by version number. */
export type EventVersions = Readonly<Partial<Record<number, z.ZodType>>>;

// Type-level helpers for numeric version keys (supports versions 1..20).
type Descending = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
type Successor = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

/** The highest version key present in `V`. */
export type LatestVersion<V, D extends number[] = Descending> = D extends [
  infer Head extends number,
  ...infer Rest extends number[],
]
  ? Head extends keyof V
    ? Head
    : LatestVersion<V, Rest>
  : never;

type VersionKeys<V> = Extract<keyof V, number>;
type SchemaAt<V, K> = K extends keyof V ? (V[K] extends z.ZodType ? V[K] : never) : never;
type NextKey<K extends number> = K extends keyof Successor ? Successor[K] : never;

/** One upcaster per non-latest version: vN data → vN+1 input. */
export type Upcasters<V> = {
  [K in Exclude<VersionKeys<V>, LatestVersion<V>>]: (
    data: z.output<SchemaAt<V, K>>,
  ) => z.input<SchemaAt<V, NextKey<K>>>;
};

/** The `data` shape stations and publishers see: the latest version's output. */
export type LatestData<V> = z.output<SchemaAt<V, LatestVersion<V>>>;

type UpcastField<V> = [Exclude<VersionKeys<V>, LatestVersion<V>>] extends [never]
  ? { upcast?: undefined }
  : { upcast: Upcasters<V> };

export type EventDefinitionInput<TType extends string, V extends EventVersions> = {
  /** `subject.pastTenseVerb`, e.g. `track.changed`. */
  type: TType;
  /** Real-time channel namespace, e.g. `music`. */
  domain: string;
  kind: EventKind;
  /** One line describing when the event is published. */
  description: string;
  versions: V;
} & UpcastField<V>;

export interface EventDefinition<TType extends string = string, TData = unknown> {
  readonly type: TType;
  readonly domain: string;
  readonly kind: EventKind;
  readonly description: string;
  /** Latest version number. */
  readonly latest: number;
  /** Supported versions, ascending. */
  readonly supportedVersions: readonly number[];
  /** Validate `data` at `version` and upcast it to the latest shape. Throws on failure. */
  readonly toLatest: (version: number, data: unknown) => TData;
  /** Validate `data` against the latest version. Throws on failure. */
  readonly parseLatest: (data: unknown) => TData;
  /** Phantom field carrying the data type; never set at runtime. */
  readonly __data?: TData;
}

export const EVENT_TYPE_PATTERN = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;
export const EVENT_DOMAIN_PATTERN = /^[a-z][a-z0-9-]*$/;

export class EventDefinitionError extends Error {
  override name = 'EventDefinitionError';
}

/** Thrown when event data fails validation, or an upcaster produces invalid output. */
export class EventDataError extends Error {
  override name = 'EventDataError';
  constructor(
    readonly eventType: string,
    readonly version: number,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`Invalid data for ${eventType} v${version}:\n${z.prettifyError(new z.ZodError(issues))}`);
  }
}

/**
 * Define a versioned event. Version keys must be contiguous integers, and every
 * version except the latest needs an upcaster to the next version.
 */
export function defineEvent<const TType extends string, const V extends EventVersions>(
  input: EventDefinitionInput<TType, V>,
): EventDefinition<TType, LatestData<V>> {
  const { type, domain, kind, description, versions } = input;
  if (!EVENT_TYPE_PATTERN.test(type)) {
    throw new EventDefinitionError(
      `Event type "${type}" must look like "subject.pastTenseVerb" (e.g. "track.changed").`,
    );
  }
  if (!EVENT_DOMAIN_PATTERN.test(domain)) {
    throw new EventDefinitionError(
      `Event "${type}" has domain "${domain}"; domains are lowercase kebab-case (e.g. "music").`,
    );
  }

  const supportedVersions = Object.keys(versions)
    .map(Number)
    .sort((a, b) => a - b);
  const latest = supportedVersions.at(-1);
  const first = supportedVersions[0];
  if (latest === undefined || first === undefined) {
    throw new EventDefinitionError(`Event "${type}" must declare at least one version.`);
  }
  supportedVersions.forEach((version, index) => {
    if (!Number.isInteger(version) || version < 1 || version !== first + index) {
      throw new EventDefinitionError(
        `Event "${type}" versions must be contiguous positive integers; got ${supportedVersions.join(', ')}.`,
      );
    }
  });

  const upcasters = (input.upcast ?? {}) as Partial<Record<number, (data: unknown) => unknown>>;
  for (const version of supportedVersions.slice(0, -1)) {
    if (typeof upcasters[version] !== 'function') {
      throw new EventDefinitionError(
        `Event "${type}" is missing an upcaster from v${version} to v${version + 1}.`,
      );
    }
  }
  for (const key of Object.keys(upcasters).map(Number)) {
    if (key === latest || !supportedVersions.includes(key)) {
      throw new EventDefinitionError(
        `Event "${type}" has an upcaster for v${key}, which is not a non-latest supported version.`,
      );
    }
  }

  const schemaFor = (version: number): z.ZodType => {
    const schema = versions[version];
    if (!schema) throw new EventDefinitionError(`Event "${type}" has no v${version} schema.`);
    return schema;
  };

  const parseAt = (version: number, data: unknown): unknown => {
    const result = schemaFor(version).safeParse(data);
    if (!result.success) throw new EventDataError(type, version, result.error.issues);
    return result.data;
  };

  const toLatest = (version: number, data: unknown): LatestData<V> => {
    if (!supportedVersions.includes(version)) {
      throw new EventDataError(type, version, [
        {
          code: 'custom',
          path: [],
          message: `Version ${version} is not supported (supported: ${supportedVersions.join(', ')}).`,
          input: data,
        },
      ]);
    }
    let current = parseAt(version, data);
    for (let v = version; v < latest; v++) {
      const upcaster = upcasters[v];
      if (!upcaster) throw new EventDefinitionError(`Missing upcaster for ${type} v${v}.`);
      current = parseAt(v + 1, upcaster(current));
    }
    return current as LatestData<V>;
  };

  return Object.freeze({
    type,
    domain,
    kind,
    description,
    latest,
    supportedVersions: Object.freeze(supportedVersions),
    toLatest,
    parseLatest: (data: unknown) => toLatest(latest, data),
  });
}
