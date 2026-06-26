import type { SkillScope, SkillsListEntry } from '@inkeep/open-knowledge-core';
import { useLingui } from '@lingui/react/macro';

/** Scope render order — global above project (broadest reach first). Shared by
 *  the Settings skills list and the sidebar Skills section. */
export const SKILL_SCOPE_ORDER: readonly SkillScope[] = ['global', 'project'] as const;

export function skillNameSetsByScope(
  skills: readonly SkillsListEntry[],
): Record<SkillScope, Set<string>> {
  return {
    project: new Set(skills.filter((s) => s.scope === 'project').map((s) => s.name)),
    global: new Set(skills.filter((s) => s.scope === 'global').map((s) => s.name)),
  };
}

const PACK_SKILL_DISPLAY_PREFIX = 'open-knowledge-pack-';

export function skillDisplayName(name: string): string {
  return name.startsWith(PACK_SKILL_DISPLAY_PREFIX)
    ? name.slice(PACK_SKILL_DISPLAY_PREFIX.length)
    : name;
}

export function useSkillScopeLabels(): Record<SkillScope, string> {
  const { t } = useLingui();
  return { project: t`Project`, global: t`Global` };
}

export function useSkillScopePillLabels(): Record<SkillScope, string> {
  const { t } = useLingui();
  return { project: t`Project Skill`, global: t`Global Skill` };
}
