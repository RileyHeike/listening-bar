/**
 * Turn `cdk deploy --outputs-file` JSON into what CI needs:
 *   - a runtime /config.json for a site that calls the API cross-origin
 *     (previews) or same-origin (--same-origin), and
 *   - KEY=value lines appended to $GITHUB_ENV.
 *
 *   tsx scripts/ci-outputs.ts outputs.json --config ../apps/web/dist/config.json
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
if (!file) throw new Error('Usage: ci-outputs.ts <outputs.json> [--config <path>] [--same-origin]');
const flag = (name: string) => {
  const index = flags.indexOf(name);
  return index === -1 ? undefined : flags[index + 1];
};

const outputs = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string>>;
const stateless = Object.entries(outputs).find(([name]) => name.endsWith('-stateless'))?.[1];
if (!stateless?.ApiUrl) throw new Error(`No stateless outputs in ${file}.`);

const realtime = {
  httpHost: stateless.RealtimeHttpHost ?? '',
  realtimeHost: stateless.RealtimeHost ?? '',
  authToken: stateless.RealtimeToken ?? '',
};

const configPath = flag('--config');
if (configPath) {
  const apiBase = flags.includes('--same-origin')
    ? '/api'
    : `${stateless.ApiUrl.replace(/\/$/, '')}/api`;
  writeFileSync(configPath, `${JSON.stringify({ apiBase, realtime }, null, 2)}\n`);
}

if (process.env.GITHUB_ENV) {
  const lines = {
    BAR_API_URL: stateless.ApiUrl,
    BAR_REALTIME_HTTP_HOST: realtime.httpHost,
    BAR_REALTIME_HOST: realtime.realtimeHost,
    BAR_REALTIME_TOKEN: realtime.authToken,
    ...(stateless.SiteUrl ? { BAR_SITE_URL: stateless.SiteUrl } : {}),
  };
  appendFileSync(
    process.env.GITHUB_ENV,
    Object.entries(lines)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
}
