/**
 * CDK entry. Choose what to build with context:
 *   -c env=production | staging | account
 *   -c env=preview -c pr=<number>
 *   -c env=sandbox -c user=<name>
 * Optional: -c siteDist=<path to apps/web/dist> to deploy the site.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { App } from 'aws-cdk-lib';
import { configs, project } from '../config/index.ts';
import { buildBarApp } from '../lib/app.ts';
import { repoRoot } from '../lib/bundling.ts';
import type { Extension } from '../lib/extensions.ts';
import { discoverModules } from '../lib/modules.ts';
import { resolveTarget } from '../lib/naming.ts';

async function loadExtensions(dir: string): Promise<Map<string, Extension>> {
  const extensions = new Map<string, Extension>();
  if (!existsSync(dir)) return extensions;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const loaded = (await import(pathToFileURL(join(dir, file)).href)) as { default: Extension };
    extensions.set(loaded.default.name, loaded.default);
  }
  return extensions;
}

const app = new App();
const context = (key: string) => app.node.tryGetContext(key) as string | undefined;
const envName = context('env');
const target =
  envName === 'account'
    ? 'account'
    : resolveTarget({ env: envName, pr: context('pr'), user: context('user') });

buildBarApp({
  app,
  project,
  target,
  config: target === 'account' ? undefined : configs[target.kind],
  modules: await discoverModules(join(repoRoot, 'modules')),
  extensions: await loadExtensions(join(repoRoot, 'infra/extensions')),
  generatedDir: join(repoRoot, 'infra/.generated'),
  siteDist: context('siteDist'),
  account: process.env.CDK_DEFAULT_ACCOUNT,
});
