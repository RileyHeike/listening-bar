import { fileURLToPath } from 'node:url';
import type { BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs';
import { OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
export const repoPath = (path: string) => `${repoRoot}${path}`;

/** ESM bundles with source maps; the AWS SDK v3 ships in the Node 24 runtime. */
export const bundling: BundlingOptions = {
  format: OutputFormat.ESM,
  mainFields: ['module', 'main'],
  minify: true,
  sourceMap: true,
  target: 'node24',
  externalModules: ['@aws-sdk/*'],
  // Some dependencies still call require(); give ESM bundles one.
  banner:
    "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
};
