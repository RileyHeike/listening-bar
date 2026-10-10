// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import { flatConfigs as importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * One flat config for the whole workspace. Each package runs `eslint .` and
 * ESLint resolves this file from the linted file's directory upward.
 *
 * Package boundaries are enforced in three layers:
 *   1. pnpm's isolated node_modules: undeclared packages do not resolve.
 *   2. import-x/no-extraneous-dependencies: imports must be declared in the
 *      nearest package.json.
 *   3. no-restricted-imports below: stations never import stations, modules
 *      never import modules, nothing reaches into another package by path.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/cdk.out/**',
      '**/.generated/**',
      '**/coverage/**',
      '**/playwright-report/**',
      'tools/generators/templates/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
  },
  importX.typescript,
  {
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
      'import-x/core-modules': ['astro:transitions', 'astro:transitions/client', 'astro:content'],
    },
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { includeInternal: true }],
      'import-x/no-relative-packages': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-named-as-default-member': 'off',
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/packages/*/**', '**/stations/*/**', '**/modules/*/**'],
              message: 'Import other workspace packages by name (e.g. @bar/core), never by path.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  // React (islands in stations, @bar/ui, @bar/room, apps/web).
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs['recommended-latest'].rules,
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.configs.recommended,
  },
  {
    files: ['packages/room/**', 'packages/ui/**', 'stations/**', 'apps/web/src/**'],
    languageOptions: { globals: { ...globals.browser } },
  },
  // Astro components: syntax-level rules only (type-aware rules do not apply).
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  {
    files: ['**/*.astro'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Stations: no cross-station imports, no direct network access.
  {
    files: ['stations/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@bar/station-*'],
              message: 'Stations never import other stations. Move shared code to @bar/ui.',
            },
            {
              group: ['**/stations/*/**', '**/packages/*/**', '**/modules/*/**'],
              message: 'Import workspace packages by name, never by path.',
            },
            {
              group: ['@bar/server', '@bar/module-*'],
              message: 'Stations are front-end only.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Stations read the API only through the typed client in @bar/room.',
        },
        {
          name: 'WebSocket',
          message: 'Live data comes only through @bar/room stores.',
        },
      ],
    },
  },
  // Modules: no cross-module imports.
  {
    files: ['modules/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@bar/module-*'],
              message: 'Modules never import other modules.',
            },
            {
              group: ['**/stations/*/**', '**/packages/*/**', '**/modules/*/**'],
              message: 'Import workspace packages by name, never by path.',
            },
          ],
        },
      ],
    },
  },
  // Tests and config files may use dev dependencies freely.
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**', '**/*.config.{js,ts}', 'tools/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Test fakes often implement async interfaces without awaiting.
      '@typescript-eslint/require-await': 'off',
    },
  },
  prettier,
);
