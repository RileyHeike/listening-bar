import { getSecret as fetchSecret } from '@aws-lambda-powertools/parameters/secrets';

const CACHE_SECONDS = 300;

/**
 * Read a Secrets Manager secret, cached per warm container. Names are
 * environment-prefixed by infra: getSecret('api-token') reads
 * "<env>/api-token". Modules read secrets only through this.
 */
export async function getSecret(
  name: string,
  env = process.env.BAR_ENV ?? 'test',
): Promise<string> {
  const value = await fetchSecret(`${env}/${name}`, { maxAge: CACHE_SECONDS });
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Secret "${env}/${name}" is missing or not a string.`);
  }
  return value;
}
