import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PlopTypes } from '@turbo/gen';
import { EMPTY, generators } from './specs.ts';

/*
 * Turborepo generators. Run them through `pnpm gen` (tools/generators/cli.ts),
 * which validates flags and passes them as answers; never interactively.
 */

const pascal = (kebab: string) =>
  kebab
    .split(/[-.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
const camel = (kebab: string) => {
  const p = pascal(kebab);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
/** Single-quoted JS string literal. */
const str = (value: unknown) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // `pnpm gen` runs generators from the repo root.
  const root = process.cwd();
  const templates = join(root, 'tools/generators/templates');

  plop.setHelper('str', str);
  plop.setHelper('eq', (a: unknown, b: unknown) => a === b);
  plop.setHelper('concat', (...parts: unknown[]) => parts.slice(0, -1).join(''));

  const prompts = (name: string): PlopTypes.PromptQuestion[] =>
    (generators[name]?.flags ?? []).map((flag) => ({
      type: 'input',
      name: flag.name,
      message: flag.description,
      default: flag.defaultValue === '' ? EMPTY : flag.defaultValue,
    }));

  /**
   * Turn EMPTY sentinels back into empty strings. Mutates the answers, because
   * plop merges raw answers over action data when rendering templates.
   */
  const clean = (answers: unknown): Record<string, string> => {
    const record = answers as Record<string, string>;
    for (const [key, value] of Object.entries(record)) if (value === EMPTY) record[key] = '';
    return record;
  };

  /** Format generated files and refresh the workspace so they pass checks immediately. */
  const finish =
    (
      paths: (answers: Record<string, string>) => string[],
      install = false,
    ): PlopTypes.CustomActionFunction =>
    (answers) => {
      const files = paths(answers as Record<string, string>);
      if (install)
        execFileSync('pnpm', ['install', '--prefer-offline'], { cwd: root, stdio: 'inherit' });
      execFileSync('pnpm', ['exec', 'prettier', '--write', '--log-level=warn', ...files], {
        cwd: root,
        stdio: 'inherit',
      });
      return `Formatted ${files.join(', ')}`;
    };

  plop.setGenerator('station', {
    description: generators.station?.description ?? '',
    prompts: prompts('station'),
    actions: (answers) => {
      const a = clean(answers);
      const data = {
        ...a,
        pascal: pascal(a.id ?? ''),
        island: a.hydrate !== 'none',
        pageId: (a.target ?? '').split(':')[0],
      };
      const dir = `stations/${a.id}`;
      const actions: PlopTypes.ActionType[] = [
        {
          type: 'addMany',
          destination: join(root, dir),
          base: join(templates, 'station'),
          templateFiles: join(templates, 'station/**/*.hbs'),
          globOptions: { dot: true, ignore: ['**/Island.tsx.hbs', '**/sleeve.svg.hbs'] },
          data,
          abortOnFail: true,
        },
      ];
      if (data.island) {
        actions.push({
          type: 'add',
          path: join(root, dir, `src/${data.pascal}.tsx`),
          templateFile: join(templates, 'station/src/Island.tsx.hbs'),
          data,
        });
      }
      if (a.route) {
        actions.push({
          type: 'add',
          path: join(root, dir, 'sleeve.svg'),
          templateFile: join(templates, 'station/sleeve.svg.hbs'),
          data,
        });
      }
      actions.push(finish(() => [dir], true));
      return actions;
    },
  });

  plop.setGenerator('page', {
    description: generators.page?.description ?? '',
    prompts: prompts('page'),
    actions: (answers) => {
      const a = clean(answers);
      const route = a.route ?? '/';
      const file = route === '/' ? 'index' : route.slice(1);
      const depth = file.split('/').length - 1;
      const params = [...route.matchAll(/\[([a-zA-Z0-9]+)\]/g)].map((m) => m[1]);
      const data = {
        ...a,
        slotList: (a.slots ?? '').split(','),
        up: '../'.repeat(depth + 1),
        params,
        hasParams: params.length > 0,
        title: pascal(a.id ?? '').replace(/([a-z])([A-Z])/g, '$1 $2'),
      };
      const defPath = `apps/web/src/page-defs/${a.id}.ts`;
      const pagePath = `apps/web/src/pages/${file}.astro`;
      if (existsSync(join(root, pagePath))) throw new Error(`${pagePath} already exists.`);
      return [
        {
          type: 'add',
          path: join(root, defPath),
          templateFile: join(templates, 'page/page-def.ts.hbs'),
          data,
        },
        {
          type: 'add',
          path: join(root, pagePath),
          templateFile: join(templates, 'page/page.astro.hbs'),
          data,
        },
        finish(() => [defPath, pagePath]),
      ];
    },
  });

  plop.setGenerator('module', {
    description: generators.module?.description ?? '',
    prompts: prompts('module'),
    actions: (answers) => {
      const a = clean(answers);
      const name = a.name ?? '';
      const data = {
        ...a,
        camel: camel(name),
        envName: `BAR_TABLE_${name.toUpperCase().replace(/-/g, '_')}`,
      };
      const dir = `modules/${name}`;
      return [
        {
          type: 'addMany',
          destination: join(root, dir),
          base: join(templates, 'module'),
          templateFiles: join(templates, 'module/**/*.hbs'),
          globOptions: { dot: true },
          data,
          abortOnFail: true,
        },
        finish(() => [dir], true),
      ];
    },
  });

  plop.setGenerator('event', {
    description: generators.event?.description ?? '',
    prompts: prompts('event'),
    actions: (answers) => {
      const a = clean(answers);
      const kebab = (a.type ?? '')
        .replace(/\./g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
      const data = { ...a, kebab, ident: camel(kebab) };
      const files = {
        definition: `packages/core/src/events/types/${kebab}.ts`,
        test: `packages/core/test/events/${kebab}.test.ts`,
        fixture: `fixtures/src/events/${kebab}.ts`,
        registry: 'packages/core/src/events/registry.ts',
        fixtures: 'fixtures/src/index.ts',
      };
      return [
        {
          type: 'add',
          path: join(root, files.definition),
          templateFile: join(templates, 'event/definition.ts.hbs'),
          data,
        },
        {
          type: 'add',
          path: join(root, files.test),
          templateFile: join(templates, 'event/event.test.ts.hbs'),
          data,
        },
        {
          type: 'add',
          path: join(root, files.fixture),
          templateFile: join(templates, 'event/fixture.ts.hbs'),
          data,
        },
        {
          type: 'modify',
          path: join(root, files.registry),
          pattern: /(\/\/ gen:event-import)/,
          template: "import { {{ident}} } from './types/{{kebab}}.ts';\n$1",
          data,
        },
        {
          type: 'modify',
          path: join(root, files.registry),
          pattern: /(\s*\/\/ gen:event-entry)/,
          template: '\n  {{ident}},$1',
          data,
        },
        {
          type: 'modify',
          path: join(root, files.fixtures),
          pattern: /(\/\/ gen:fixture-import)/,
          template: "import {{ident}} from './events/{{kebab}}.ts';\n$1",
          data,
        },
        {
          type: 'modify',
          path: join(root, files.fixtures),
          pattern: /(\s*\/\/ gen:fixture-entry)/,
          template: "\n  '{{type}}': {{ident}},$1",
          data,
        },
        finish(() => Object.values(files)),
      ];
    },
  });
}
