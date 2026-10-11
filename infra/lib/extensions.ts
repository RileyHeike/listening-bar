import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import type { z } from 'zod';
import type { DiscoveredModule } from './modules.ts';

/** What an extension may touch when applied to a module. */
export interface ExtensionContext {
  prefix: string;
  /** The Lambda serving the module's routes. */
  fn: IFunction;
  table: ITable | undefined;
  /** Expose configuration to the module's code. */
  addEnvironment(name: string, value: string): void;
}

export interface Extension<O extends z.ZodType = z.ZodType> {
  name: string;
  optionsSchema: O;
  apply(
    scope: Construct,
    module: DiscoveredModule,
    options: z.output<O>,
    ctx: ExtensionContext,
  ): void;
}

/**
 * A named resource plugin (infra/extensions/<name>.ts) for things outside
 * the manifest vocabulary. Adding one needs owner approval; using one does not.
 */
export const defineExtension = <O extends z.ZodType>(extension: Extension<O>): Extension<O> =>
  extension;
