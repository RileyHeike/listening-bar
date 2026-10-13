/**
 * Owner gate: may this pull request merge without the owner?
 *
 * The owner is needed when the PR touches a path owned in .github/CODEOWNERS
 * (architecture, contracts, tokens, infra, CI…), or is labelled
 * `needs-design-review` (big visual change) or `needs-owner` (a question).
 * The owner signs off by approving the PR on its latest commit, or, for PRs
 * opened under the owner's own account (GitHub forbids self-approval), by
 * adding the `owner-approved` label after the latest push. `needs-owner`
 * holds until the owner removes it.
 *
 * Runs in CI from the base branch (owner-gate.yml), so a PR cannot change
 * the rules it is judged by:
 *
 *   node tools/ci/owner-gate.ts   (GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, OWNER)
 */
import { appendFileSync, readFileSync } from 'node:fs';

export interface Rule {
  pattern: string;
  owners: string[];
}

/** Parse CODEOWNERS; a pattern with no owners makes matching paths unowned. */
export function parseCodeowners(text: string): Rule[] {
  return text
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [pattern = '', ...owners] = line.split(/\s+/);
      return { pattern, owners };
    });
}

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.startsWith('/');
  const directory = pattern.endsWith('/');
  const body = pattern
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .split('**')
    .map((part) => part.replace(/\*/g, '[^/]*'))
    .join('.*');
  // Unanchored patterns match at any depth, like .gitignore.
  const prefix = anchored ? '^' : '^(?:.*/)?';
  const suffix = directory ? '/.*$' : '(?:/.*)?$';
  return new RegExp(prefix + body + suffix);
}

/** Owners of a repository path; the last matching rule wins. */
export function ownersOf(path: string, rules: Rule[]): string[] {
  let owners: string[] = [];
  for (const rule of rules) if (toRegExp(rule.pattern).test(path)) owners = rule.owners;
  return owners;
}

export interface Review {
  user: string;
  state: string;
  commitId: string;
}

export interface GateInput {
  owner: string;
  rules: Rule[];
  files: string[];
  labels: string[];
  headSha: string;
  /** When the latest commit was pushed (committer date), ISO 8601. */
  headAt: string;
  /** Reviews in submission order. */
  reviews: Review[];
  /** When the owner last added `owner-approved`, if they did. */
  ownerLabelledAt?: string | undefined;
}

export interface GateResult {
  open: boolean;
  reasons: string[];
  approved: boolean;
}

export function evaluate(input: GateInput): GateResult {
  const handle = `@${input.owner}`;
  const owned = input.files.filter((file) => ownersOf(file, input.rules).includes(handle));
  const reasons: string[] = [];
  if (owned.length > 0) {
    const shown = owned.slice(0, 10).map((file) => `\`${file}\``);
    if (owned.length > 10) shown.push(`and ${String(owned.length - 10)} more`);
    reasons.push(`touches owner-reviewed paths: ${shown.join(', ')}`);
  }
  if (input.labels.includes('needs-design-review'))
    reasons.push('big visual change (`needs-design-review`)');

  const ownerReviews = input.reviews.filter(
    (review) => review.user === input.owner && review.state !== 'COMMENTED',
  );
  const latest = ownerReviews.at(-1);
  const approved =
    (latest?.state === 'APPROVED' && latest.commitId === input.headSha) ||
    (input.ownerLabelledAt !== undefined && input.ownerLabelledAt >= input.headAt);

  if (input.labels.includes('needs-owner')) {
    return {
      open: false,
      approved,
      reasons: [...reasons, 'waiting on an owner decision (`needs-owner`)'],
    };
  }
  return { open: reasons.length === 0 || approved, approved, reasons };
}

export function summarize(result: GateResult, owner: string): string {
  if (result.reasons.length === 0) return 'Routine change: no owner review needed.';
  const why = result.reasons.map((reason) => `- ${reason}`).join('\n');
  if (result.open) return `Approved by @${owner}.\n\n${why}`;
  return [
    `Waiting for @${owner}:`,
    '',
    why,
    '',
    'To sign off: approve the PR on its latest commit, or (for PRs opened under your own account) add the `owner-approved` label.',
    ...(result.reasons.some((reason) => reason.includes('needs-owner'))
      ? ['Remove `needs-owner` once the question is answered.']
      : []),
  ].join('\n');
}

async function main() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, OWNER } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER || !OWNER)
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER and OWNER are required.');

  const api = async <T>(path: string): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPOSITORY}/${path}${separator}per_page=100&page=${String(page)}`,
        {
          headers: {
            authorization: `Bearer ${GITHUB_TOKEN}`,
            accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) throw new Error(`GitHub ${path}: ${String(response.status)}`);
      const batch = (await response.json()) as T | T[];
      if (!Array.isArray(batch)) return [batch];
      items.push(...batch);
      if (batch.length < 100) return items;
    }
  };

  const [pr] = await api<{ head: { sha: string }; labels: { name: string }[] }>(
    `pulls/${PR_NUMBER}`,
  );
  if (!pr) throw new Error(`Pull request ${PR_NUMBER} not found.`);
  const files = await api<{ filename: string; previous_filename?: string }>(
    `pulls/${PR_NUMBER}/files`,
  );
  const reviews = await api<{ user: { login: string } | null; state: string; commit_id: string }>(
    `pulls/${PR_NUMBER}/reviews`,
  );
  const events = await api<{
    event: string;
    actor: { login: string } | null;
    label?: { name: string };
    created_at: string;
  }>(`issues/${PR_NUMBER}/events`);
  const [head] = await api<{ commit: { committer: { date: string } } }>(`commits/${pr.head.sha}`);

  const result = evaluate({
    owner: OWNER,
    rules: parseCodeowners(readFileSync('.github/CODEOWNERS', 'utf8')),
    // A rename out of an owned path counts as touching it.
    files: files.flatMap((file) => [file.filename, file.previous_filename ?? []].flat()),
    labels: pr.labels.map((label) => label.name),
    headSha: pr.head.sha,
    headAt: head?.commit.committer.date ?? new Date().toISOString(),
    reviews: reviews.map((review) => ({
      user: review.user?.login ?? '',
      state: review.state,
      commitId: review.commit_id,
    })),
    ownerLabelledAt: events
      .filter(
        (event) =>
          event.event === 'labeled' &&
          event.label?.name === 'owner-approved' &&
          event.actor?.login === OWNER,
      )
      .at(-1)?.created_at,
  });

  const summary = `## Owner gate\n\n${summarize(result, OWNER)}\n`;
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (!result.open) process.exitCode = 1;
}

if (process.argv[1] === import.meta.filename) await main();
