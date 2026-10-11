/**
 * AppSync Events Lambda authorizer for the public. The site is public, so
 * anyone may connect and subscribe; namespaces only accept publishes signed
 * with IAM (the backend), so this authorizer can never grant publishing.
 * A Lambda authorizer (rather than an API key) means nothing expires.
 */
interface AuthorizerEvent {
  authorizationToken?: string;
}

interface AuthorizerResult {
  isAuthorized: boolean;
  ttlOverride?: number;
}

export const PUBLIC_REALTIME_TOKEN = 'listening-bar-public';

export const handler = async (event: AuthorizerEvent): Promise<AuthorizerResult> => {
  await Promise.resolve();
  return { isAuthorized: event.authorizationToken === PUBLIC_REALTIME_TOKEN, ttlOverride: 3600 };
};
