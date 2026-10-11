import type { EnvConfig } from './types.ts';

export default {
  kind: 'staging',
  lambdaGroups: { api: ['*'] },
  site: true,
  retainData: false,
  pointInTimeRecovery: false,
  terminationProtection: false,
  devRoutes: false,
  alarms: false,
} satisfies EnvConfig;
