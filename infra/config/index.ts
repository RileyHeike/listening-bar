import type { EnvConfig } from './types.ts';
import preview from './preview.ts';
import production from './production.ts';
import sandbox from './sandbox.ts';
import staging from './staging.ts';

export const configs: Record<EnvConfig['kind'], EnvConfig> = {
  production,
  staging,
  preview,
  sandbox,
};
export type { EnvConfig } from './types.ts';
export { project } from './project.ts';
