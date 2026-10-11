/**
 * Real-time channel for an event domain. Each domain is an AppSync Events
 * channel namespace; the bar publishes on one channel inside it. Shared by
 * the server publisher and the browser transport.
 */
export const realtimeChannel = (domain: string): string => `/${domain}/room`;
