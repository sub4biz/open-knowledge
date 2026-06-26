import type { HocuspocusProvider } from '@hocuspocus/provider';
import { parseManagedArtifactName, type SkillScope } from '@inkeep/open-knowledge-core';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { toast } from 'sonner';
import { SkillProperties } from '@/components/SkillProperties';
import { TemplateProperties } from '@/components/TemplateProperties';
import { useDocumentContext } from '@/editor/DocumentContext';
import { moveTemplate } from '@/lib/folder-config-api';
import {
  parseProjectSkillContentDocName,
  projectSkillContentDocName,
  skillLiveDocName,
  templateDocName,
} from '@/lib/managed-artifact-doc-name';
import { openManagedArtifactTab } from '@/lib/open-managed-artifact-tab';
import { useSkillScopeLabels } from '@/lib/skill-scope';
import { moveSkill, moveSkillScope } from '@/lib/skills-api';

export function ManagedArtifactProperties({
  docName,
  provider,
}: {
  docName: string;
  provider: HocuspocusProvider;
}) {
  const parsed = parseManagedArtifactName(docName);
  if (parsed?.kind === 'skill') {
    return (
      <SkillPropertiesPanel
        provider={provider}
        docName={docName}
        scope={parsed.scope}
        name={parsed.name}
      />
    );
  }
  if (parsed?.kind === 'template') {
    return (
      <TemplatePropertiesPanel
        provider={provider}
        docName={docName}
        folder={parsed.folder}
        name={parsed.name}
      />
    );
  }
  const projectSkillName = parseProjectSkillContentDocName(docName);
  if (projectSkillName) {
    return (
      <ProjectSkillPropertiesPanel provider={provider} docName={docName} name={projectSkillName} />
    );
  }
  return null;
}

function useManagedArtifactRetarget(): (fromDocName: string, toDocName: string) => void {
  const { closeDocument } = useDocumentContext();
  return (fromDocName, toDocName) => {
    if (fromDocName === toDocName) return;
    openManagedArtifactTab(toDocName);
    closeDocument(fromDocName);
  };
}

function SkillPropertiesPanel({
  provider,
  docName,
  scope,
  name,
}: {
  provider: HocuspocusProvider;
  docName: string;
  scope: SkillScope;
  name: string;
}) {
  const { t } = useLingui();
  const scopeLabels = useSkillScopeLabels();
  const retarget = useManagedArtifactRetarget();
  const [renameError, setRenameError] = useState<string | null>(null);
  const [movingScope, setMovingScope] = useState(false);

  async function handleRename(next: string) {
    setRenameError(null);
    const result = await moveSkill({ scope, fromName: name, toName: next });
    if (!result.ok) {
      setRenameError(result.error);
      toast.error(t`Couldn't rename skill: ${result.error}`);
      return;
    }
    toast.success(t`Skill renamed`);
    retarget(docName, skillLiveDocName(scope, next));
  }

  async function handleScopeChange(next: SkillScope) {
    if (next === scope || movingScope) return;
    setMovingScope(true);
    const result = await moveSkillScope({ name, fromScope: scope, toScope: next });
    setMovingScope(false);
    if (!result.ok) {
      toast.error(t`Couldn't move skill: ${result.error}`);
      return;
    }
    const skipped = result.skippedBinaryFiles?.length ?? 0;
    if (skipped > 0) {
      toast.warning(
        t`Moved "${name}" to ${scopeLabels[next]} (${skipped} binary file(s) not copied)`,
      );
    } else {
      toast.success(t`Moved "${name}" to ${scopeLabels[next]}`);
    }
    retarget(docName, skillLiveDocName(next, name));
  }

  return (
    <SkillProperties
      provider={provider}
      name={name}
      onRename={handleRename}
      nameError={renameError}
      nameEditable={!movingScope}
      scopeControl={{ scope, onScopeChange: handleScopeChange }}
    />
  );
}

function ProjectSkillPropertiesPanel({
  provider,
  docName,
  name,
}: {
  provider: HocuspocusProvider;
  docName: string;
  name: string;
}) {
  const { t } = useLingui();
  const scopeLabels = useSkillScopeLabels();
  const retarget = useManagedArtifactRetarget();
  const [renameError, setRenameError] = useState<string | null>(null);
  const [movingScope, setMovingScope] = useState(false);

  async function handleRename(next: string) {
    setRenameError(null);
    const result = await moveSkill({ scope: 'project', fromName: name, toName: next });
    if (!result.ok) {
      setRenameError(result.error);
      toast.error(t`Couldn't rename skill: ${result.error}`);
      return;
    }
    toast.success(t`Skill renamed`);
    retarget(docName, projectSkillContentDocName(next));
  }

  async function handleScopeChange(next: SkillScope) {
    if (next === 'project' || movingScope) return;
    setMovingScope(true);
    const result = await moveSkillScope({ name, fromScope: 'project', toScope: next });
    setMovingScope(false);
    if (!result.ok) {
      toast.error(t`Couldn't move skill: ${result.error}`);
      return;
    }
    const skipped = result.skippedBinaryFiles?.length ?? 0;
    if (skipped > 0) {
      toast.warning(
        t`Moved "${name}" to ${scopeLabels[next]} (${skipped} binary file(s) not copied)`,
      );
    } else {
      toast.success(t`Moved "${name}" to ${scopeLabels[next]}`);
    }
    retarget(docName, skillLiveDocName(next, name));
  }

  return (
    <SkillProperties
      provider={provider}
      name={name}
      onRename={handleRename}
      nameError={renameError}
      nameEditable={!movingScope}
      scopeControl={{ scope: 'project', onScopeChange: handleScopeChange }}
    />
  );
}

function TemplatePropertiesPanel({
  provider,
  docName,
  folder,
  name,
}: {
  provider: HocuspocusProvider;
  docName: string;
  folder: string;
  name: string;
}) {
  const { t } = useLingui();
  const retarget = useManagedArtifactRetarget();
  const [renameError, setRenameError] = useState<string | null>(null);

  async function handleRename(next: string) {
    setRenameError(null);
    const result = await moveTemplate({
      fromFolder: folder,
      fromName: name,
      toFolder: folder,
      toName: next,
    });
    if (!result.ok) {
      setRenameError(result.error);
      toast.error(t`Couldn't rename template: ${result.error}`);
      return;
    }
    toast.success(t`Template renamed`);
    retarget(docName, templateDocName(folder, next));
  }

  return (
    <TemplateProperties
      provider={provider}
      name={name}
      folder={folder}
      onRename={handleRename}
      nameError={renameError}
    />
  );
}
