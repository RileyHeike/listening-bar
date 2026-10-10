/**
 * Fallback typing for `.astro` imports outside Astro's language server
 * (ESLint's type-aware rules, plain tsc). `astro check` resolves the real
 * component types and ignores this wildcard.
 */
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

  const Component: AstroComponentFactory;
  export default Component;
}
