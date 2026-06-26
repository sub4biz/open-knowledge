import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readInstalledSkills } from '../installed-skills-marker.ts';
import { installPackSkill } from './install-pack-skill.ts';

function setUpEditor(proj: string, editorDir: string): void {
  const platformDir = join(proj, editorDir, 'skills', 'open-knowledge');
  mkdirSync(platformDir, { recursive: true });
  writeFileSync(join(platformDir, 'SKILL.md'), '# platform\n');
}

function tmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'ok-seed-skill-'));
}

describe('installPackSkill', () => {
  test('authors the pack skill into .ok/skills + installs it for a set-up editor', async () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    const installed = await installPackSkill(proj, 'knowledge-base');
    expect(installed).toEqual(['Claude Code']);
    expect(
      existsSync(join(proj, '.ok', 'skills', 'open-knowledge-pack-knowledge-base', 'SKILL.md')),
    ).toBe(true);
    expect(
      existsSync(join(proj, '.claude', 'skills', 'open-knowledge-pack-knowledge-base', 'SKILL.md')),
    ).toBe(true);
    const marker = readInstalledSkills(proj).skills['open-knowledge-pack-knowledge-base'];
    expect(marker).toBeDefined();
    expect(marker?.scope).toBe('project');
    expect(marker?.hosts).toEqual(['claude']);
  });

  test('installs for every set-up editor (claude + cursor + codex)', async () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    setUpEditor(proj, '.cursor');
    setUpEditor(proj, '.codex');
    expect((await installPackSkill(proj, 'entity-vault')).sort()).toEqual([
      'Claude Code',
      'Codex',
      'Cursor',
    ]);
    const marker = readInstalledSkills(proj).skills['open-knowledge-pack-entity-vault'];
    expect(marker?.hosts.sort()).toEqual(['claude', 'codex', 'cursor']);
  });

  test('installs the codebase-wiki pack skill from the source assets', async () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    expect(await installPackSkill(proj, 'codebase-wiki')).toEqual(['Claude Code']);
    expect(
      existsSync(join(proj, '.claude', 'skills', 'open-knowledge-pack-codebase-wiki', 'SKILL.md')),
    ).toBe(true);
  });

  test('no-op when no editor is set up (no platform skill present)', async () => {
    const proj = tmpProject();
    expect(await installPackSkill(proj, 'knowledge-base')).toEqual([]);
    expect(readInstalledSkills(proj).skills['open-knowledge-pack-knowledge-base']).toBeUndefined();
  });

  test('no-op for a pack that ships no skill', async () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    expect(await installPackSkill(proj, 'no-such-pack')).toEqual([]);
    expect(existsSync(join(proj, '.ok', 'skills', 'open-knowledge-pack-no-such-pack'))).toBe(false);
  });

  test('re-seed preserves a user-edited pack skill (no rm+cp clobber)', async () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    await installPackSkill(proj, 'knowledge-base');
    const sourcePath = join(
      proj,
      '.ok',
      'skills',
      'open-knowledge-pack-knowledge-base',
      'SKILL.md',
    );
    expect(existsSync(sourcePath)).toBe(true);

    const edited =
      '---\nname: open-knowledge-pack-knowledge-base\ndescription: my edit\n---\nmine\n';
    writeFileSync(sourcePath, edited, 'utf-8');

    const installed = await installPackSkill(proj, 'knowledge-base');
    expect(installed).toEqual(['Claude Code']);
    expect(readFileSync(sourcePath, 'utf-8')).toBe(edited);
    expect(
      existsSync(join(proj, '.claude', 'skills', 'open-knowledge-pack-knowledge-base', 'SKILL.md')),
    ).toBe(true);
  });

  test('refuses to install through an editor dir that symlinks outside the project', async () => {
    const proj = tmpProject();
    const outside = tmpProject();
    symlinkSync(outside, join(proj, '.claude'));
    mkdirSync(join(outside, 'skills', 'open-knowledge'), { recursive: true });
    writeFileSync(join(outside, 'skills', 'open-knowledge', 'SKILL.md'), '# platform\n');
    expect(await installPackSkill(proj, 'knowledge-base')).toEqual([]);
    expect(existsSync(join(outside, 'skills', 'open-knowledge-pack-knowledge-base'))).toBe(false);
    expect(readInstalledSkills(proj).skills['open-knowledge-pack-knowledge-base']).toBeUndefined();
  });
});
