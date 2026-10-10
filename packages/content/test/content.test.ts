import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Project } from '../src/index.ts';
import {
  ContentError,
  getFeaturedProject,
  getMenuSeed,
  getProfile,
  getProject,
  getProjects,
  getRoles,
  parseMenuSeed,
  parseProject,
  parseRole,
} from '../src/index.ts';

const project = (frontmatter: string, body = 'Body.') => `---\n${frontmatter}\n---\n${body}\n`;
const valid = `title: T
status: demo
year: 2026
catalog: BAR-010
summary: S
pressing: { format: F }
tracklist: [{ title: A }]`;

describe('placeholder content', () => {
  it('loads typed, validated projects with one featured', () => {
    const projects = getProjects();
    expectTypeOf(projects).toEqualTypeOf<readonly Project[]>();
    expect(projects.length).toBeGreaterThanOrEqual(4);
    expect(getFeaturedProject().featured).toBe(true);
    expect(new Set(projects.map((p) => p.status))).toEqual(
      new Set(['demo', 'studio', 'pressed', 'out']),
    );
  });

  it('keeps bracketed placeholder copy', () => {
    for (const p of getProjects()) expect(p.title).toMatch(/^\[.+\]$/);
    expect(getProfile().name).toBe('[Your Name]');
  });

  it('finds projects by slug', () => {
    const [first] = getProjects();
    expect(getProject(first!.slug)).toBe(first);
    expect(getProject('nope')).toBeUndefined();
  });

  it('renders Markdown bodies to HTML', () => {
    expect(getFeaturedProject().html).toMatch(/^<p>/);
  });

  it('sorts roles current-first, then newest', () => {
    const roles = getRoles();
    expect(roles[0]?.end).toBeUndefined();
    const ended = roles.slice(1).map((r) => r.start);
    expect(ended).toEqual([...ended].sort().reverse());
  });

  it('loads a menu seed matching the live menu schema', () => {
    expect(Object.keys(getMenuSeed())).toEqual([
      'onRotation',
      'reading',
      'growing',
      'learning',
      'building',
      'drinking',
    ]);
  });
});

describe('validation', () => {
  it('applies defaults', () => {
    const parsed = parseProject('/x/projects/demo.md', project(valid));
    expect(parsed).toMatchObject({ slug: 'demo', featured: false, credits: [], links: [] });
    expect(parsed.tracklist[0]?.done).toBe(false);
  });

  it.each([
    ['missing frontmatter', 'Just text', /needs YAML frontmatter/],
    ['bad YAML', project('title: [unclosed'), /not valid YAML/],
    ['bad status', project(valid.replace('demo', 'released')), /status/],
    ['bad catalog', project(valid.replace('BAR-010', 'bar10')), /BAR-003/],
    ['unknown field', project(`${valid}\nmood: blue`), /mood/],
  ])('rejects %s, naming the file', (_, raw, message) => {
    expect(() => parseProject('/x/projects/demo.md', raw)).toThrow(ContentError);
    expect(() => parseProject('/x/projects/demo.md', raw)).toThrow(message);
    expect(() => parseProject('/x/projects/demo.md', raw)).toThrow('/x/projects/demo.md');
  });

  it('rejects non-slug file names', () => {
    expect(() => parseProject('/x/projects/My Project.md', project(valid))).toThrow(/kebab-case/);
  });

  it('rejects roles that end before they start', () => {
    const raw = project(
      'title: R\norg: O\nstart: "2024-01"\nend: "2023-01"\nsummary: S\nstandoutTracks: [A]',
    );
    expect(() => parseRole('/x/roles/r.md', raw)).toThrow(/must not be before/);
  });

  it('rejects a menu seed missing a row', () => {
    expect(() => parseMenuSeed('/x/menu-seed.yaml', 'reading: R')).toThrow(
      /menu-seed.yaml is invalid/,
    );
  });
});
