import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseFrontmatterYaml,
  stripFrontmatter,
  unwrapFrontmatterFences,
} from '@inkeep/open-knowledge-core';
import { resolveBundledSkillDir } from './build-skill-zip.ts';
import { compareSemver } from './git-preflight.ts';
import { PACK_SKILL_PREFIX } from './skill-projection.ts';

export function isPackSkillName(name: string): boolean {
  return name.startsWith(PACK_SKILL_PREFIX);
}

export function packIdFromSkillName(name: string): string | null {
  return isPackSkillName(name) ? name.slice(PACK_SKILL_PREFIX.length) : null;
}

export function readSkillVersion(raw: string): string | undefined {
  const { frontmatter: fenced } = stripFrontmatter(raw);
  if (fenced === '') return undefined;
  const { map } = parseFrontmatterYaml(unwrapFrontmatterFences(fenced));
  const version = map?.version;
  return typeof version === 'string' && version.trim() !== '' ? version : undefined;
}

function bundledPackSkillDir(name: string): string | null {
  const packId = packIdFromSkillName(name);
  if (packId === null) return null;
  try {
    return resolveBundledSkillDir(`packs/${packId}`, { checkDesktop: false });
  } catch {
    return null;
  }
}

export function bundledPackVersion(name: string): string | undefined {
  const dir = bundledPackSkillDir(name);
  if (dir === null) return undefined;
  try {
    return readSkillVersion(readFileSync(join(dir, 'SKILL.md'), 'utf-8'));
  } catch {
    return undefined;
  }
}

export function readBundledPackSkill(
  name: string,
): { content: string; version: string | undefined } | null {
  const dir = bundledPackSkillDir(name);
  if (dir === null) return null;
  let content: string;
  try {
    content = readFileSync(join(dir, 'SKILL.md'), 'utf-8');
  } catch {
    return null;
  }
  return { content, version: readSkillVersion(content) };
}

export function packUpdateAvailable(
  installedVersion: string | undefined,
  bundledVersion: string,
): boolean {
  return installedVersion === undefined
    ? true
    : compareSemver(bundledVersion, installedVersion) > 0;
}

export function computePackUpdateStatus(
  name: string,
  installedVersion: string | undefined,
): { bundledVersion?: string; updateAvailable?: boolean } {
  const bundledVersion = bundledPackVersion(name);
  if (bundledVersion === undefined) return {};
  return { bundledVersion, updateAvailable: packUpdateAvailable(installedVersion, bundledVersion) };
}
