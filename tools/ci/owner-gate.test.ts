import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GateInput, Review } from './owner-gate.ts';
import { evaluate, ownersOf, parseCodeowners } from './owner-gate.ts';

const rules = parseCodeowners(readFileSync('.github/CODEOWNERS', 'utf8'));
const OWNER = 'RileyHeike';

const base: GateInput = {
  owner: OWNER,
  rules,
  files: ['stations/hifi/src/index.astro'],
  labels: [],
  headSha: 'head',
  headAt: '2026-10-12T10:00:00Z',
  reviews: [],
};
const review = (state: string, commitId = 'head', user = OWNER): Review => ({
  user,
  state,
  commitId,
});

describe('CODEOWNERS matching', () => {
  it.each([
    'docs/decisions.md',
    'docs/contracts/station.md',
    'CLAUDE.md',
    '.claude/settings.json',
    'packages/tokens/src/room.css',
    'packages/core/src/manifest/schema.ts',
    'infra/stacks/ci-access.ts',
    '.github/workflows/pr.yml',
    'tools/generators/config.ts',
    'tools/ci/owner-gate.ts',
    'turbo.json',
  ])('the owner reviews %s', (path) => {
    expect(ownersOf(path, rules)).toEqual([`@${OWNER}`]);
  });

  it.each([
    'stations/hifi/src/index.astro',
    'packages/core/src/events/types/spins-updated.ts',
    'packages/content/content/about.md',
    'infra/package.json',
    'packages/tokens/package.json',
    'docs/how-to/add-a-station.md',
    'pnpm-lock.yaml',
  ])('%s is routine', (path) => {
    expect(ownersOf(path, rules)).toEqual([]);
  });

  it('anchors, globs, and lets the last match win', () => {
    const custom = parseCodeowners('*.md @a\n/docs/ @b\n/docs/free.md\n');
    expect(ownersOf('README.md', custom)).toEqual(['@a']);
    expect(ownersOf('nested/x.md', custom)).toEqual(['@a']);
    expect(ownersOf('docs/x.md', custom)).toEqual(['@b']);
    expect(ownersOf('docs/free.md', custom)).toEqual([]);
    expect(ownersOf('other/docs/x.ts', custom)).toEqual([]);
  });
});

describe('owner gate', () => {
  it('opens for routine changes', () => {
    expect(evaluate(base).open).toBe(true);
  });

  it('waits for owned paths and big visual changes', () => {
    expect(evaluate({ ...base, files: ['infra/lib/app.ts'] }).open).toBe(false);
    expect(evaluate({ ...base, labels: ['needs-design-review'] }).open).toBe(false);
  });

  it("opens only on the owner's approval of the latest commit", () => {
    const owned = { ...base, files: ['packages/tokens/src/room.css'] };
    expect(evaluate({ ...owned, reviews: [review('APPROVED')] }).open).toBe(true);
    expect(evaluate({ ...owned, reviews: [review('APPROVED', 'older')] }).open).toBe(false);
    expect(evaluate({ ...owned, reviews: [review('APPROVED', 'head', 'someone')] }).open).toBe(
      false,
    );
    expect(
      evaluate({ ...owned, reviews: [review('APPROVED'), review('CHANGES_REQUESTED')] }).open,
    ).toBe(false);
  });

  it('accepts the owner-approved label only after the latest push', () => {
    const owned = { ...base, files: ['CLAUDE.md'] };
    expect(evaluate({ ...owned, ownerLabelledAt: '2026-10-12T11:00:00Z' }).open).toBe(true);
    expect(evaluate({ ...owned, ownerLabelledAt: '2026-10-12T09:00:00Z' }).open).toBe(false);
  });

  it('holds needs-owner even when approved', () => {
    expect(evaluate({ ...base, labels: ['needs-owner'], reviews: [review('APPROVED')] }).open).toBe(
      false,
    );
  });
});
