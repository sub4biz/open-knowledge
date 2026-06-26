import type { SkillScope } from '@inkeep/open-knowledge-core';
import { SkillMarkdownViewer } from '@/components/SkillMarkdownViewer';
import { ViewerErrorPane, ViewerLoadingPane } from '@/components/ViewerStatusPane';
import { loadSkillFileText } from '@/lib/skills-api';
import { useViewerText } from './use-viewer-text';

const DATA_ATTR = 'data-skill-markdown';

export function SkillMarkdownLoader({
  scope,
  name,
  path,
  fileName,
}: {
  scope: SkillScope;
  name: string;
  path: string;
  fileName: string;
}) {
  const fetchState = useViewerText({
    loadText: (signal) => loadSkillFileText({ scope, name, path }, signal),
  });

  if (fetchState.status === 'loading') {
    return <ViewerLoadingPane fileName={fileName} dataAttr={DATA_ATTR} />;
  }
  if (fetchState.status === 'error') {
    return (
      <ViewerErrorPane fileName={fileName} dataAttr={DATA_ATTR} message={fetchState.message} />
    );
  }
  return <SkillMarkdownViewer fileName={fileName} text={fetchState.content} />;
}
