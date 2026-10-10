import type { EventData } from '@bar/core';
import { registry } from '@bar/core';
import { marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Profile, Project, Role } from './schemas.ts';
import { ProfileSchema, ProjectFrontmatterSchema, RoleFrontmatterSchema } from './schemas.ts';

export class ContentError extends Error {
  override name = 'ContentError';
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function validate<T extends z.ZodType>(schema: T, data: unknown, file: string): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContentError(`${file} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function readYaml(raw: string, file: string): unknown {
  try {
    return parseYaml(raw) as unknown;
  } catch (error) {
    throw new ContentError(`${file} is not valid YAML: ${(error as Error).message}`);
  }
}

/** Split a Markdown file into frontmatter (YAML) and rendered HTML. */
export function parseMarkdown(raw: string, file: string): { data: unknown; html: string } {
  const match = FRONTMATTER.exec(raw);
  if (!match) throw new ContentError(`${file} needs YAML frontmatter between "---" lines.`);
  const [, yaml = '', body = ''] = match;
  return { data: readYaml(yaml, file), html: marked.parse(body.trim(), { async: false }) };
}

/** Slug from a content path: "…/projects/weather-station.md" → "weather-station". */
export function slugFromPath(path: string): string {
  const slug = /([^/]+)\.md$/.exec(path)?.[1];
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new ContentError(`${path}: file names must be kebab-case slugs ending in .md.`);
  }
  return slug;
}

export function parseProject(path: string, raw: string): Project {
  const { data, html } = parseMarkdown(raw, path);
  return { slug: slugFromPath(path), html, ...validate(ProjectFrontmatterSchema, data, path) };
}

export function parseRole(path: string, raw: string): Role {
  const { data, html } = parseMarkdown(raw, path);
  return { slug: slugFromPath(path), html, ...validate(RoleFrontmatterSchema, data, path) };
}

export function parseProfile(path: string, raw: string): Profile {
  return validate(ProfileSchema, readYaml(raw, path), path);
}

/** The menu seed uses the latest `menu.updated` schema, so it can stand in for live data. */
export function parseMenuSeed(path: string, raw: string): EventData<'menu.updated'> {
  const data = readYaml(raw, path);
  try {
    return registry.get('menu.updated').parseLatest(data);
  } catch (error) {
    throw new ContentError(`${path} is invalid: ${(error as Error).message}`);
  }
}
