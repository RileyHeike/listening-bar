import type { EnvConfig } from './types.ts';

export default {
  kind: 'preview',
  lambdaGroups: { api: ['*'] },
  site: false,
  retainData: false,
  pointInTimeRecovery: false,
  terminationProtection: false,
  devRoutes: true,
  alarms: false,
} satisfies EnvConfig;
