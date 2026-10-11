import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ModuleManifest } from '@bar/core';
import { ModuleManifestSchema } from '@bar/core';

export interface DiscoveredModule {
  manifest: ModuleManifest;
  /** Absolute path of the module package. */
  dir: string;
}

/** Find and validate every modules/<name>/module.ts (docs/contracts/module.md). */
export async function discoverModules(modulesDir: string): Promise<DiscoveredModule[]> {
  if (!existsSync(modulesDir)) return [];
  const found: DiscoveredModule[] = [];
  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = resolve(modulesDir, entry.name);
    const file = join(dir, 'module.ts');
    if (!existsSync(file)) continue;
    const loaded = (await import(pathToFileURL(file).href)) as { default?: unknown };
    const result = ModuleManifestSchema.safeParse(loaded.default);
    if (!result.success)
      throw new Error(`modules/${entry.name}/module.ts is invalid: ${result.error.message}`);
    if (result.data.name !== entry.name) {
      throw new Error(
        `modules/${entry.name}: manifest name "${result.data.name}" must match the folder.`,
      );
    }
    found.push({ manifest: result.data, dir });
  }
  return found.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/** Which Lambda group serves each module (and the platform routes). */
export function assignGroups(
  groups: Record<string, string[]>,
  moduleNames: readonly string[],
): { byModule: Map<string, string>; platform: string; members: Map<string, string[]> } {
  const wildcard = Object.entries(groups).find(([, names]) => names.includes('*'))?.[0];
  const byModule = new Map<string, string>();
  for (const [group, names] of Object.entries(groups)) {
    for (const name of names) if (name !== '*') byModule.set(name, group);
  }
  for (const name of [...moduleNames, 'room']) {
    if (!byModule.has(name)) {
      if (!wildcard)
        throw new Error(`Module "${name}" is in no Lambda group and there is no "*" group.`);
      byModule.set(name, wildcard);
    }
  }
  const members = new Map<string, string[]>();
  for (const name of moduleNames) {
    const group = byModule.get(name) ?? '';
    members.set(group, [...(members.get(group) ?? []), name]);
  }
  for (const group of Object.keys(groups)) if (!members.has(group)) members.set(group, []);
  return { byModule, platform: byModule.get('room') ?? '', members };
}
