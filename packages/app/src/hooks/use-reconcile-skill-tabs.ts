import {
  type ManagedArtifactScope,
  parseManagedArtifactName,
  type SkillsListEntry,
  skillLiveDocName,
} from '@inkeep/open-knowledge-core';
import { useEffect, useRef } from 'react';
import { useDocumentContext } from '@/editor/DocumentContext';
import { parseProjectSkillContentDocName } from '@/lib/managed-artifact-doc-name';
import { openManagedArtifactTab } from '@/lib/open-managed-artifact-tab';
import { useSkills } from './use-skills';

/** A skill tab's identity parsed from its live doc name (project content doc or
 *  global managed-artifact doc), or null when the doc name isn't a skill. */
export function parseSkillTabDocName(
  docName: string,
): { scope: ManagedArtifactScope; name: string } | null {
  const projectName = parseProjectSkillContentDocName(docName);
  if (projectName) return { scope: 'project', name: projectName };
  const parsed = parseManagedArtifactName(docName);
  if (parsed?.kind === 'skill') return { scope: parsed.scope, name: parsed.name };
  return null;
}

export type SkillTabReconcileAction =
  | { kind: 'retarget'; fromDocName: string; toDocName: string }
  | { kind: 'close'; docName: string };

export function computeSkillTabReconcile(
  openTabDocNames: ReadonlyArray<string>,
  skills: ReadonlyArray<Pick<SkillsListEntry, 'name' | 'scope'>>,
): SkillTabReconcileAction[] {
  const present = new Set(skills.map((s) => `${s.scope}\u0000${s.name}`));
  const actions: SkillTabReconcileAction[] = [];
  for (const docName of openTabDocNames) {
    const tab = parseSkillTabDocName(docName);
    if (!tab) continue;
    if (present.has(`${tab.scope}\u0000${tab.name}`)) continue; // still here — leave it
    const otherScope: ManagedArtifactScope = tab.scope === 'project' ? 'global' : 'project';
    if (present.has(`${otherScope}\u0000${tab.name}`)) {
      actions.push({
        kind: 'retarget',
        fromDocName: docName,
        toDocName: skillLiveDocName(otherScope, tab.name),
      });
    } else {
      actions.push({ kind: 'close', docName });
    }
  }
  return actions;
}

export function useReconcileSkillTabs(): void {
  const { openTabs, closeDocument } = useDocumentContext();
  const hasSkillTab = openTabs.some((docName) => parseSkillTabDocName(docName) !== null);
  const skillsState = useSkills({ enabled: hasSkillTab });
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (skillsState.status !== 'ready') return;
    const skills = skillsState.data;
    const signature = `${openTabs.join('\u0001')}\u0002${skills
      .map((s) => `${s.scope}\u0000${s.name}`)
      .sort()
      .join('\u0001')}`;
    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;

    const actions = computeSkillTabReconcile(openTabs, skills);
    for (const action of actions) {
      if (action.kind === 'retarget') {
        openManagedArtifactTab(action.toDocName);
        closeDocument(action.fromDocName);
      } else {
        closeDocument(action.docName);
      }
    }
  }, [skillsState, openTabs, closeDocument]);
}
