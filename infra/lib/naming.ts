import type { EnvConfig } from '../config/types.ts';

/**
 * Every stack and named resource is prefixed with its environment:
 * "prod", "staging", "pr-<n>", "dev-<user>" (docs/infrastructure.md).
 */
export interface Target {
  kind: EnvConfig['kind'];
  prefix: string;
  /** Pull request number (previews). */
  pr?: number;
}

export function resolveTarget(context: { env?: string; pr?: string; user?: string }): Target {
  switch (context.env) {
    case 'production':
      return { kind: 'production', prefix: 'prod' };
    case 'staging':
      return { kind: 'staging', prefix: 'staging' };
    case 'preview': {
      const pr = Number(context.pr);
      if (!Number.isInteger(pr) || pr < 1)
        throw new Error('Previews need -c pr=<pull request number>.');
      return { kind: 'preview', prefix: `pr-${pr}`, pr };
    }
    case 'sandbox': {
      const user = (context.user ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (!user) throw new Error('Sandboxes need -c user=<name> (pnpm sandbox:deploy sets it).');
      return { kind: 'sandbox', prefix: `dev-${user}` };
    }
    default:
      throw new Error(
        `Unknown -c env=${context.env ?? '(missing)'}. Use production, staging, preview, sandbox, or account.`,
      );
  }
}
