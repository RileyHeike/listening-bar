import { Logger } from '@aws-lambda-powertools/logger';

/**
 * Structured logger (Powertools). Log the envelope id as the correlation id
 * whenever an event is involved: `logger.appendKeys({ eventId })`.
 */
export const logger = new Logger({ serviceName: 'listening-bar' });

export const withEnvelope = (envelope: { id: string; type: string }) => ({
  eventId: envelope.id,
  eventType: envelope.type,
});
