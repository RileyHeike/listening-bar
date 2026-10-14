/**
 * Claude Code PostToolUse hook for Edit/Write (.claude/settings.json): format
 * the edited file, and lint CSS and Astro files with Stylelint so a raw
 * colour or material token is caught right away rather than at commit.
 * Stylelint problems exit 2, which shows them to Claude. Does nothing
 * outside the project or before `pnpm install`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const bin = (name: string) => join(root, 'node_modules', '.bin', name);

const input = JSON.parse(readFileSync(0, 'utf8')) as { tool_input?: { file_path?: string } };
const file = input.tool_input?.file_path;
const path = file ? relative(root, file) : '';
if (!file || path.startsWith('..') || !existsSync(file) || !existsSync(bin('prettier')))
  process.exit(0);

try {
  execFileSync(bin('prettier'), ['--write', '--ignore-unknown', '--log-level=error', file], {
    cwd: root,
    stdio: 'pipe',
  });
} catch {
  // A file Prettier cannot parse yet (mid-edit) is left for the next edit or the commit hook.
}

if (/\.(css|astro)$/.test(path) && existsSync(bin('stylelint'))) {
  try {
    execFileSync(bin('stylelint'), [path], { cwd: root, stdio: 'pipe' });
  } catch (error) {
    // Stylelint 17 writes its report to stderr.
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    const output = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`.trim();
    if (output) {
      process.stderr.write(`Stylelint (docs/design-system.md, "Tokens"):\n${output}\n`);
      process.exit(2);
    }
  }
}
