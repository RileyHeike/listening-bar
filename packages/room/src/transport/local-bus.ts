import type { LocalTransport } from './local.ts';
import { createLocalTransport } from './local.ts';

let bus: LocalTransport | undefined;

/** The page's single local bus (created on first use). */
export const localBus = (): LocalTransport => (bus ??= createLocalTransport());
