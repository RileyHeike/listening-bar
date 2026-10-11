import { describe, expect, it } from 'vitest';
import { DIRECTORY_INDEX_FUNCTION } from '../constructs/site.ts';
import { PREVIEW_ROUTER_FUNCTION } from '../stacks/preview-site.ts';

interface CfRequest {
  uri: string;
  headers: Record<string, { value: string }>;
}

/** Run CloudFront Function source the way the edge does: a top-level `handler`. */
type Handler = (event: { request: CfRequest }) => CfRequest & { statusCode?: number };
const load = (source: string): Handler => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${source}; return handler;`) as () => Handler;
  return factory();
};

const request = (uri: string, host = 'example.com'): { request: CfRequest } => ({
  request: { uri, headers: { host: { value: host } } },
});

describe('directory index function', () => {
  const handler = load(DIRECTORY_INDEX_FUNCTION);

  it.each([
    ['/', '/index.html'],
    ['/workshop', '/workshop/index.html'],
    ['/workshop/', '/workshop/index.html'],
    ['/workshop/featured-release', '/workshop/featured-release/index.html'],
    ['/_astro/app.js', '/_astro/app.js'],
    ['/config.json', '/config.json'],
  ])('%s → %s', (uri, expected) => {
    expect(handler(request(uri)).uri).toBe(expected);
  });
});

describe('preview router function', () => {
  const handler = load(PREVIEW_ROUTER_FUNCTION);

  it('maps the PR host onto its bucket prefix', () => {
    expect(handler(request('/workshop', 'pr-12.preview.example.com')).uri).toBe(
      '/pr-12/workshop/index.html',
    );
    expect(handler(request('/', 'pr-3.preview.example.com')).uri).toBe('/pr-3/index.html');
    expect(handler(request('/config.json', 'pr-3.preview.example.com')).uri).toBe(
      '/pr-3/config.json',
    );
  });

  it('rejects hosts that are not a PR', () => {
    expect(handler(request('/', 'preview.example.com')).statusCode).toBe(404);
  });
});
