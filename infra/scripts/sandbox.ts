/**
 * Personal cloud sandbox (dev-<user>): deploy, hotswap-watch, or destroy,
 * and wire its endpoints into apps/web/.env.local for `pnpm dev`.
 *
 *   pnpm sandbox:deploy   pnpm sandbox:watch   pnpm sandbox:destroy
 *
 * Runs as the least-privileged `listening-bar` profile (the
 * listening-bar-developer role) when it exists in ~/.aws/config, unless
 * AWS_PROFILE is set. Needs `aws login` and a bootstrapped account.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from '../lib/bundling.ts';
import { resolveTarget } from '../lib/naming.ts';

const infraDir = join(repoRoot, 'infra');
const envFile = join(repoRoot, 'apps/web/.env.local');
const outputsFile = join(infraDir, '.cdk-outputs.sandbox.json');
const KEYS = [
  'SANDBOX_API_URL',
  'SANDBOX_REALTIME_HTTP_HOST',
  'SANDBOX_REALTIME_HOST',
  'SANDBOX_REALTIME_TOKEN',
];

function sandboxUser(): string {
  if (process.env.BAR_SANDBOX_USER) return process.env.BAR_SANDBOX_USER;
  try {
    const name = execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim();
    if (name) return name.split(/\s+/)[0] ?? name;
  } catch {
    // Fall back to the OS user.
  }
  return userInfo().username;
}

const PROJECT_PROFILE = 'listening-bar';

/** Prefer the project's developer-role profile for everyday deploys. */
function awsEnv(): NodeJS.ProcessEnv {
  if (process.env.AWS_PROFILE) return process.env;
  const config = join(homedir(), '.aws/config');
  const hasProfile =
    existsSync(config) && readFileSync(config, 'utf8').includes(`[profile ${PROJECT_PROFILE}]`);
  if (!hasProfile) return process.env;
  console.log(`Using AWS profile "${PROJECT_PROFILE}" (set AWS_PROFILE to override).`);
  return { ...process.env, AWS_PROFILE: PROJECT_PROFILE };
}

function cdk(args: string[]): void {
  const result = spawnSync('pnpm', ['exec', 'cdk', ...args], {
    cwd: infraDir,
    stdio: 'inherit',
    env: awsEnv(),
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Replace the sandbox keys in .env.local, keeping anything else the developer put there. */
function writeEnv(values: Record<string, string> | null): void {
  const kept = existsSync(envFile)
    ? readFileSync(envFile, 'utf8')
        .split('\n')
        .filter((line) => line && !KEYS.some((key) => line.startsWith(`${key}=`)))
    : [];
  const lines = [...kept, ...(values ? Object.entries(values).map(([k, v]) => `${k}=${v}`) : [])];
  writeFileSync(envFile, lines.length ? `${lines.join('\n')}\n` : '');
}

const command = process.argv[2];
const user = sandboxUser();
const context = ['-c', 'env=sandbox', '-c', `user=${user}`];

switch (command) {
  case 'deploy': {
    cdk([
      'deploy',
      '--all',
      ...context,
      '--require-approval',
      'never',
      '--outputs-file',
      outputsFile,
    ]);
    const outputs = JSON.parse(readFileSync(outputsFile, 'utf8')) as Record<
      string,
      Record<string, string>
    >;
    const stateless = Object.entries(outputs).find(([name]) => name.endsWith('-stateless'))?.[1];
    if (!stateless) throw new Error(`No stateless stack outputs in ${outputsFile}.`);
    writeEnv({
      SANDBOX_API_URL: stateless.ApiUrl ?? '',
      SANDBOX_REALTIME_HTTP_HOST: stateless.RealtimeHttpHost ?? '',
      SANDBOX_REALTIME_HOST: stateless.RealtimeHost ?? '',
      SANDBOX_REALTIME_TOKEN: stateless.RealtimeToken ?? '',
    });
    console.log(
      `\nSandbox dev-${user} is up. Endpoints written to apps/web/.env.local; run \`pnpm dev\`.`,
    );
    break;
  }
  case 'watch':
    cdk(['watch', '--hotswap', ...context]);
    break;
  case 'destroy':
    cdk(['destroy', '--all', ...context, '--force']);
    writeEnv(null);
    rmSync(outputsFile, { force: true });
    break;
  default:
    console.error('Usage: tsx scripts/sandbox.ts deploy | watch | destroy');
    process.exit(1);
}
