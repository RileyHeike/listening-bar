import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { configs } from '../config/index.ts';
import type { EnvConfig } from '../config/types.ts';
import type { ProjectSettings } from '../lib/app.ts';
import { buildBarApp } from '../lib/app.ts';
import { repoRoot } from '../lib/bundling.ts';
import type { Extension } from '../lib/extensions.ts';
import { discoverModules } from '../lib/modules.ts';
import type { Target } from '../lib/naming.ts';
import { resolveTarget } from '../lib/naming.ts';
import queue from './fixtures/extensions/queue.ts';

export const fixtureModulesDir = fileURLToPath(new URL('./fixtures/modules', import.meta.url));
export const fixtureExtensions = new Map<string, Extension>([[queue.name, queue]]);

export const testProject: ProjectSettings = {
  name: 'listening-bar',
  account: '111111111111',
  region: 'us-west-2',
  certificateRegion: 'us-east-1',
  domain: undefined,
  githubRepository: undefined,
  alertEmail: undefined,
  monthlyBudgetUsd: 25,
};

const testGeneratedDir = () => {
  const dir = join(repoRoot, 'infra/.generated/test');
  mkdirSync(dir, { recursive: true });
  return dir;
};

/** Synthesize an environment (without bundling Lambda code) and return its templates. */
export async function synth(
  context: { env: string; pr?: string; user?: string },
  options: {
    withModules?: boolean;
    project?: Partial<ProjectSettings>;
    config?: Partial<EnvConfig>;
    extensions?: Map<string, Extension>;
    /** Account of the CLI credentials (must match the project's). */
    account?: string;
  } = {},
) {
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const target: Target | 'account' = context.env === 'account' ? 'account' : resolveTarget(context);
  buildBarApp({
    app,
    project: { ...testProject, ...options.project },
    target,
    config: target === 'account' ? undefined : { ...configs[target.kind], ...options.config },
    modules: options.withModules ? await discoverModules(fixtureModulesDir) : [],
    extensions: options.extensions ?? fixtureExtensions,
    // Lambda entries must sit under the repo root (NodejsFunction projectRoot).
    generatedDir: mkdtempSync(join(testGeneratedDir(), 'synth-')),
    account: options.account,
  });
  const assembly = app.synth();
  const template = (name: string) => Template.fromStack(app.node.findChild(name) as never);
  return { app, assembly, template };
}
