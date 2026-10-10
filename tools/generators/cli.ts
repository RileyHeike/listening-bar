/**
 * `pnpm gen <generator> --flag value …`: flags only, never prompts.
 * Validates flags, then runs the Turborepo generator non-interactively.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EMPTY, generators } from './specs.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

function usage(): string {
  const lines = ['Usage: pnpm gen <generator> --flag value …', ''];
  for (const [name, spec] of Object.entries(generators)) {
    lines.push(`  ${name}: ${spec.description}`);
    for (const flag of spec.flags) {
      lines.push(
        `    --${flag.name.padEnd(9)} ${flag.required ? '(required)' : '(optional)'} ${flag.description}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

function fail(message: string): never {
  console.error(`✖ ${message}\n\n${usage()}`);
  process.exit(1);
}

export function parseArgs(argv: readonly string[]): { generator: string; answers: string[] } {
  const [generator, ...rest] = argv;
  if (!generator || generator.startsWith('-')) fail('Missing generator name.');
  const spec = generators[generator];
  if (!spec) fail(`Unknown generator "${generator}".`);

  const values = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i] ?? '';
    if (!token.startsWith('--')) fail(`Unexpected argument "${token}". Use --flag value.`);
    const [key = '', inline] = token.slice(2).split(/=(.*)/s);
    const value = inline ?? rest[++i];
    if (value === undefined || (inline === undefined && value.startsWith('--'))) {
      fail(`Flag --${key} needs a value.`);
    }
    if (!spec.flags.some((flag) => flag.name === key))
      fail(`Unknown flag --${key} for "${generator}".`);
    values.set(key, value);
  }

  const answers = spec.flags.map((flag) => {
    const value = values.get(flag.name) ?? flag.defaultValue;
    if (value === undefined) fail(`Missing required flag --${flag.name} for "${generator}".`);
    const error = flag.validate(value);
    if (error) fail(`--${flag.name} ${error} (got "${value}").`);
    return value;
  });
  return { generator, answers };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { generator, answers } = parseArgs(process.argv.slice(2));
  // Generators cannot take an empty answer; EMPTY stands in for one.
  const args = answers.map((answer) => (answer === '' ? EMPTY : answer));
  const result = spawnSync(
    'pnpm',
    ['exec', 'gen', 'run', generator, '--config', 'tools/generators/config.ts', '--args', ...args],
    { cwd: root, stdio: 'inherit' },
  );
  process.exit(result.status ?? 1);
}
