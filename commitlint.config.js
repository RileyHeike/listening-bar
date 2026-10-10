import { readdirSync, existsSync } from 'node:fs';

/**
 * Commit scopes match package folder names (the package name without the
 * `@bar/`, `station-`, or `module-` prefix), plus a few repo-wide scopes.
 */
const workspaceDirs = ['apps', 'packages', 'stations', 'modules'];
const packageScopes = workspaceDirs.flatMap((dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [],
);

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        ...packageScopes,
        'infra',
        'fixtures',
        'generators',
        'ci',
        'deps',
        'docs',
        'repo',
        'release',
      ],
    ],
  },
};
