/// <reference types="astro/client" />
import type { RuntimeConfig } from '@bar/room';

declare global {
  interface ImportMetaEnv {
    /** Whether fixture data may ship in this build (dev and BAR_ENV=local only). */
    readonly BAR_FIXTURES: boolean;
    /** Runtime config in `astro dev` (sandbox endpoints or none); null in builds. */
    readonly BAR_DEV_CONFIG: RuntimeConfig | null;
  }
}
