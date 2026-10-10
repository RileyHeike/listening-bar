import type { EventData } from '@bar/core';
import { ContentError, parseMenuSeed, parseProfile, parseProject, parseRole } from './parse.ts';
import type { Profile, Project, Role } from './schemas.ts';

/*
 * Content files are bundled at build time (Vite `import.meta.glob`), parsed
 * and validated on first use. Any invalid file fails the build with its path.
 */

const projectFiles = import.meta.glob<string>('../content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const roleFiles = import.meta.glob<string>('../content/roles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const singleFiles = import.meta.glob<string>('../content/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const once = <T>(load: () => T): (() => T) => {
  let cached: { value: T } | undefined;
  return () => (cached ??= { value: load() }).value;
};

function single(name: string): [path: string, raw: string] {
  const path = `../content/${name}`;
  const raw = singleFiles[path];
  if (raw === undefined)
    throw new ContentError(`Missing content file packages/content/content/${name}.`);
  return [path, raw];
}

/** All Workshop projects: by `order`, then newest first. */
export const getProjects = once((): readonly Project[] => {
  const projects = Object.entries(projectFiles).map(([path, raw]) => parseProject(path, raw));
  const featured = projects.filter((project) => project.featured);
  if (featured.length !== 1) {
    throw new ContentError(
      `Exactly one project must be \`featured: true\`; found ${featured.length} (${featured.map((p) => p.slug).join(', ') || 'none'}).`,
    );
  }
  return projects.sort(
    (a, b) => a.order - b.order || b.year - a.year || a.slug.localeCompare(b.slug),
  );
});

export const getProject = (slug: string): Project | undefined =>
  getProjects().find((project) => project.slug === slug);

export const getFeaturedProject = (): Project => {
  const featured = getProjects().find((project) => project.featured);
  if (!featured) throw new ContentError('No featured project.');
  return featured;
};

/** Roles for the discography: current role first, then by start date descending. */
export const getRoles = once((): readonly Role[] =>
  Object.entries(roleFiles)
    .map(([path, raw]) => parseRole(path, raw))
    .sort((a, b) => (a.end ? 1 : 0) - (b.end ? 1 : 0) || b.start.localeCompare(a.start)),
);

export const getProfile = once((): Profile => parseProfile(...single('profile.yaml')));

/** Chalkboard content shown until (or instead of) live `menu.updated` events. */
export const getMenuSeed = once((): EventData<'menu.updated'> =>
  parseMenuSeed(...single('menu-seed.yaml')),
);
