import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';

/** Publishes envelopes to AppSync Events over HTTP. */
export interface RealtimePublisher {
  publish(channel: string, envelope: unknown): Promise<void>;
}

export class RealtimePublishError extends Error {
  override name = 'RealtimePublishError';
}

/**
 * IAM-signed (SigV4, service "appsync") HTTP publish. The Lambda role is
 * granted publish on the namespaces of its module's `emits` domains.
 */
export function createAppSyncPublisher(options: {
  httpHost: string;
  region: string;
  fetch?: typeof fetch;
  signer?: Pick<SignatureV4, 'sign'>;
}): RealtimePublisher {
  const signer =
    options.signer ??
    new SignatureV4({
      service: 'appsync',
      region: options.region,
      credentials: defaultProvider(),
      sha256: Sha256,
    });
  const send = options.fetch ?? fetch;

  return {
    async publish(channel, envelope) {
      const body = JSON.stringify({ channel, events: [JSON.stringify(envelope)] });
      const signed = await signer.sign({
        method: 'POST',
        protocol: 'https:',
        hostname: options.httpHost,
        path: '/event',
        headers: {
          host: options.httpHost,
          accept: 'application/json, text/javascript',
          'content-type': 'application/json; charset=UTF-8',
        },
        body,
      });
      const response = await send(`https://${options.httpHost}/event`, {
        method: 'POST',
        headers: signed.headers,
        body,
      });
      if (!response.ok) {
        throw new RealtimePublishError(
          `AppSync publish to ${channel} failed: ${response.status} ${await response.text()}`,
        );
      }
      const result = (await response.json()) as { failed?: unknown[] };
      if (result.failed && result.failed.length > 0) {
        throw new RealtimePublishError(
          `AppSync rejected the event on ${channel}: ${JSON.stringify(result.failed)}`,
        );
      }
    },
  };
}

/** Collects publishes in memory (tests, local runs without AppSync). */
export function createMemoryPublisher(): RealtimePublisher & {
  sent: { channel: string; envelope: unknown }[];
} {
  const sent: { channel: string; envelope: unknown }[] = [];
  return {
    sent,
    publish: (channel, envelope) => {
      sent.push({ channel, envelope });
      return Promise.resolve();
    },
  };
}
