import { stripFrontmatter } from '@inkeep/open-knowledge-core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sharedExtensions } from '@/editor/extensions/shared.ts';
import { getSharedMarkdownManager } from '@/editor/utils/md-singleton';

export function SkillMarkdownViewer({ fileName, text }: { fileName: string; text: string }) {
  const body = stripFrontmatter(text).body;
  const editor = useEditor(
    {
      extensions: sharedExtensions,
      editable: false,
      content: getSharedMarkdownManager().parseWithFallback(body),
      editorProps: {
        attributes: {
          class: 'pt-4 pb-4',
        },
      },
    },
    [text],
  );

  const [portalTarget] = useState(() => {
    const el = document.createElement('div');
    el.style.display = 'contents';
    return el;
  });
  const portalSlotRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const slot = portalSlotRef.current;
    if (!slot) return;
    slot.appendChild(portalTarget);
    return () => {
      if (portalTarget.parentNode === slot) slot.removeChild(portalTarget);
    };
  }, [portalTarget]);

  return (
    <main
      className="flex h-full min-h-0 flex-col bg-background"
      aria-label={fileName}
      data-skill-markdown-viewer=""
      data-skill-markdown-viewer-state="loaded"
    >
      <div className="editor-doc-scroll min-h-0 flex-1 overflow-auto">
        {/* Mirror the editor's content-column grid so prose width + side rails
            match the real editor layout. */}
        <div className="tiptap-editor">
          <div ref={portalSlotRef} style={{ display: 'contents' }} />
        </div>
      </div>
      {createPortal(
        // biome-ignore lint/plugin/no-unportaled-editor-content: portaled site — view.dom parent is the exclusively-owned portalTarget per the H6 contract (PRECEDENTS.md #44)
        <EditorContent editor={editor} className="tiptap-editor-portal-content h-full" />,
        portalTarget,
      )}
    </main>
  );
}
