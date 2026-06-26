import type { SkillScope } from '@inkeep/open-knowledge-core';
import { SkillMarkdownLoader } from '@/components/SkillMarkdownLoader';
import { TextViewer } from '@/components/TextViewer';
import { loadSkillFileText } from '@/lib/skills-api';

const MARKDOWN_EXTENSIONS = new Set(['md', 'mdx']);

export function SkillFileViewer({
  scope,
  name,
  path,
}: {
  scope: SkillScope;
  name: string;
  path: string;
}) {
  const fileName = path.split('/').pop() ?? path;
  const dot = fileName.lastIndexOf('.');
  const extension = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';

  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return <SkillMarkdownLoader scope={scope} name={name} path={path} fileName={fileName} />;
  }

  return (
    <TextViewer
      fileName={fileName}
      extension={extension}
      loadText={(signal: AbortSignal) => loadSkillFileText({ scope, name, path }, signal)}
    />
  );
}
