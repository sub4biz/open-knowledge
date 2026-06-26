import { describe, expect, test } from 'bun:test';
import {
  managedArtifactDocNameFromContentTarget,
  parseGlobalSkillBundleDoc,
  parseProjectSkillBundleDoc,
  resolveSkillBundleWikiTarget,
} from './cc1.ts';

describe('managedArtifactDocNameFromContentTarget', () => {
  test('does NOT rewrite project skill file paths — they are content docs', () => {
    expect(managedArtifactDocNameFromContentTarget('.ok/skills/my-skill/SKILL.md')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('.ok/skills/my-skill/SKILL')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('.ok/skills/my-skill/SKILL.mdx')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('some/dir/.ok/skills/deep/SKILL.md')).toBeNull();
  });

  test('maps a root-level template to a folderless template doc name', () => {
    expect(managedArtifactDocNameFromContentTarget('.ok/templates/note.md')).toBe(
      '__template__/note',
    );
  });

  test('maps a template under a folder, preserving the folder segment', () => {
    expect(managedArtifactDocNameFromContentTarget('docs/.ok/templates/note.md')).toBe(
      '__template__/docs/note',
    );
    expect(managedArtifactDocNameFromContentTarget('docs/guides/.ok/templates/note')).toBe(
      '__template__/docs/guides/note',
    );
  });

  test('returns null for paths that are not skill/template files', () => {
    expect(managedArtifactDocNameFromContentTarget('docs/getting-started.md')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('.ok/skills/my-skill/NOTES.md')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('.ok/config.yml')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('readme')).toBeNull();
    expect(managedArtifactDocNameFromContentTarget('')).toBeNull();
  });
});

describe('resolveSkillBundleWikiTarget', () => {
  const skill = '.ok/skills/demo/SKILL';

  test('resolves a references/ wiki-target to the sibling bundle ref', () => {
    expect(resolveSkillBundleWikiTarget('references/notes', skill)).toBe(
      '.ok/skills/demo/references/notes',
    );
    expect(resolveSkillBundleWikiTarget('references/sub/deep', skill)).toBe(
      '.ok/skills/demo/references/sub/deep',
    );
  });

  test('strips a markdown extension so [[references/x.md]] == [[references/x]]', () => {
    expect(resolveSkillBundleWikiTarget('references/notes.md', skill)).toBe(
      '.ok/skills/demo/references/notes',
    );
    expect(resolveSkillBundleWikiTarget('references/notes.MDX', skill)).toBe(
      '.ok/skills/demo/references/notes',
    );
  });

  test('resolves a scripts/ wiki-target too', () => {
    expect(resolveSkillBundleWikiTarget('scripts/run', skill)).toBe('.ok/skills/demo/scripts/run');
  });

  test('leaves bare names and non-bundle targets to KB-wide resolution', () => {
    expect(resolveSkillBundleWikiTarget('notes', skill)).toBeNull();
    expect(resolveSkillBundleWikiTarget('docs/intro', skill)).toBeNull();
    expect(resolveSkillBundleWikiTarget('references', skill)).toBeNull();
    expect(resolveSkillBundleWikiTarget('references/', skill)).toBeNull();
  });

  test('refuses traversal that would escape the skill dir', () => {
    expect(resolveSkillBundleWikiTarget('references/../../escape', skill)).toBeNull();
  });

  test('returns null when the source is not a project skill SKILL doc', () => {
    expect(resolveSkillBundleWikiTarget('references/notes', 'notes/index')).toBeNull();
    expect(
      resolveSkillBundleWikiTarget('references/notes', '.ok/skills/demo/references/x'),
    ).toBeNull();
    expect(resolveSkillBundleWikiTarget('references/notes', '__skill__/global/demo')).toBeNull();
  });
});

describe('parseProjectSkillBundleDoc', () => {
  test('parses a project SKILL doc', () => {
    expect(parseProjectSkillBundleDoc('.ok/skills/demo/SKILL')).toEqual({
      name: 'demo',
      kind: 'skill',
      rel: null,
    });
  });

  test('parses a project reference doc (flat and nested)', () => {
    expect(parseProjectSkillBundleDoc('.ok/skills/demo/references/notes')).toEqual({
      name: 'demo',
      kind: 'reference',
      rel: 'notes',
    });
    expect(parseProjectSkillBundleDoc('.ok/skills/demo/references/sub/deep')).toEqual({
      name: 'demo',
      kind: 'reference',
      rel: 'sub/deep',
    });
  });

  test('rejects non-bundle docs, scripts, global skills, and the bare skill dir', () => {
    expect(parseProjectSkillBundleDoc('notes/index')).toBeNull();
    expect(parseProjectSkillBundleDoc('notes/references/x')).toBeNull();
    expect(parseProjectSkillBundleDoc('.ok/skills/demo/scripts/run')).toBeNull();
    expect(parseProjectSkillBundleDoc('__skill__/global/demo')).toBeNull();
    expect(parseProjectSkillBundleDoc('.ok/skills/demo')).toBeNull();
    expect(parseProjectSkillBundleDoc('.ok/skills/demo/references')).toBeNull();
    expect(parseProjectSkillBundleDoc('.ok/skills/demo/references/')).toBeNull();
  });
});

describe('parseGlobalSkillBundleDoc', () => {
  test('parses a global SKILL doc', () => {
    expect(parseGlobalSkillBundleDoc('__skill__/global/demo')).toEqual({
      name: 'demo',
      kind: 'skill',
      rel: null,
    });
  });

  test('parses a global reference doc (flat and nested)', () => {
    expect(parseGlobalSkillBundleDoc('__skill__/global/demo/references/notes')).toEqual({
      name: 'demo',
      kind: 'reference',
      rel: 'notes',
    });
    expect(parseGlobalSkillBundleDoc('__skill__/global/demo/references/sub/deep')).toEqual({
      name: 'demo',
      kind: 'reference',
      rel: 'sub/deep',
    });
  });

  test('rejects project bundle docs, scripts, the bare dir, and other scopes', () => {
    expect(parseGlobalSkillBundleDoc('.ok/skills/demo/SKILL')).toBeNull();
    expect(parseGlobalSkillBundleDoc('.ok/skills/demo/references/notes')).toBeNull();
    expect(parseGlobalSkillBundleDoc('__skill__/global/demo/scripts/run')).toBeNull();
    expect(parseGlobalSkillBundleDoc('__skill__/global/demo/references')).toBeNull();
    expect(parseGlobalSkillBundleDoc('__skill__/global/demo/references/')).toBeNull();
    expect(parseGlobalSkillBundleDoc('__skill__/project/demo')).toBeNull();
    expect(parseGlobalSkillBundleDoc('__skill__/project/demo/references/notes')).toBeNull();
    expect(parseGlobalSkillBundleDoc('__template__/notes/daily')).toBeNull();
    expect(parseGlobalSkillBundleDoc('notes/index')).toBeNull();
  });
});
