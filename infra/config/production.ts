import type { EnvConfig } from './types.ts';

export default {
  kind: 'production',
  lambdaGroups: { api: ['*'] },
  site: true,
  retainData: true,
  pointInTimeRecovery: true,
  terminationProtection: true,
  devRoutes: false,
  alarms: true,
} satisfies EnvConfig;
