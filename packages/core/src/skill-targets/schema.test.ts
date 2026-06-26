import { describe, expect, test } from 'bun:test';
import { PROJECT_SKILL_EDITOR_IDS } from '../constants/editors.ts';
import { parseSkillTargets, SkillTargetEditorSchema } from './schema.ts';

describe('SkillTargetEditorSchema', () => {
  test('matches the derived PROJECT_SKILL_EDITOR_IDS (drift guard)', () => {
    expect([...SkillTargetEditorSchema.options].sort()).toEqual(
      [...PROJECT_SKILL_EDITOR_IDS].sort(),
    );
  });

  test('parseSkillTargets rejects an unknown editor id', () => {
    const raw = JSON.stringify({ schema: 1, targets: ['claude', 'sublime'] });
    expect(parseSkillTargets(raw)).toBeNull();
  });
});
