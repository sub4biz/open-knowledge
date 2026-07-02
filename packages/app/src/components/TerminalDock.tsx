import { useTheme } from 'next-themes';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePanelRef } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import type { TerminalDockPosition } from '@/lib/terminal-dock-store';
import { getInitialTerminalHeight, writeTerminalHeight } from '@/lib/terminal-height-store';
import { cn } from '@/lib/utils';
import { TerminalRevealTab } from './TerminalRevealTab';
import { xtermThemeForMode } from './terminal-theme';

const TERMINAL_PANEL_ID = 'terminal-dock-panel';

interface TerminalDockProps {
  readonly children: ReactNode;
  readonly visible: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly dockPosition?: TerminalDockPosition;
  readonly onBottomContainer: (el: HTMLDivElement | null) => void;
  readonly onEditorRegion: (el: HTMLDivElement | null) => void;
  readonly onReveal?: () => void;
}

export function TerminalDock({
  children,
  visible,
  onVisibleChange,
  dockPosition = 'bottom',
  onBottomContainer,
  onEditorRegion,
  onReveal,
}: TerminalDockProps) {
  const { resolvedTheme } = useTheme();
  const panelRef = usePanelRef();
  const [isCollapsed, setIsCollapsed] = useState(!visible);
  const xtermBackground = xtermThemeForMode(resolvedTheme).background;
  const bottomOpen = visible && dockPosition === 'bottom';
  const showBottomRevealTab = !visible && dockPosition === 'bottom' && onReveal != null;

  const [initialHeightPx] = useState(() => getInitialTerminalHeight());
  const heightPxRef = useRef(initialHeightPx);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function debouncedWriteHeight(px: number) {
    if (writeTimerRef.current != null) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      writeTerminalHeight(px);
      writeTimerRef.current = null;
    }, 100);
  }
  const dragUpHandlerRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      if (writeTimerRef.current != null) clearTimeout(writeTimerRef.current);
      if (dragUpHandlerRef.current != null) {
        window.removeEventListener('pointerup', dragUpHandlerRef.current);
        dragUpHandlerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const panel = panelRef.current;
    if (panel == null) return;
    if (bottomOpen) {
      panel.resize(`${heightPxRef.current}px`);
    } else {
      panel.collapse();
    }
  }, [bottomOpen, panelRef]);

  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="min-h-0 flex-1"
      data-dragging={isDragging || undefined}
    >
      <ResizablePanel minSize="5%" className="flex min-h-0 flex-col">
        {/* tabIndex -1 makes this a programmatic focus target for focus-return on
            collapse without adding it to the tab order. `relative` anchors the
            bottom-dock reveal tab to the bottom of the editor column. */}
        <div
          ref={onEditorRegion}
          tabIndex={-1}
          className="relative flex h-full min-h-0 flex-col outline-none"
        >
          {children}
          {showBottomRevealTab && onReveal ? (
            <TerminalRevealTab
              dockPosition="bottom"
              onReveal={onReveal}
              className="right-3 bottom-0"
            />
          ) : null}
        </div>
      </ResizablePanel>
      {/* The handle drags only while the bottom panel is open: you can resize it,
          and drag all the way down to collapse (hide). Otherwise it is disabled —
          when bottom-docked-and-hidden the reveal tab rendered above is the single
          way back in, and when right-docked the ways in live outside this file
          (EditorArea's reveal tab; the tab strip's dock-toggle) — so there is no
          drag-up-to-open (which would be a second, redundant way in). Gating on
          controlled props (not `isCollapsed`) means an in-progress drag-to-collapse
          completes before the handle disables on the next commit. */}
      <ResizableHandle
        withHandle={bottomOpen}
        disabled={!bottomOpen}
        onPointerDown={() => {
          if (!bottomOpen) return;
          setIsDragging(true);
          isDraggingRef.current = true;
          const handleUp = () => {
            setIsDragging(false);
            isDraggingRef.current = false;
            window.removeEventListener('pointerup', handleUp);
            dragUpHandlerRef.current = null;
          };
          dragUpHandlerRef.current = handleUp;
          window.addEventListener('pointerup', handleUp);
        }}
      />
      <ResizablePanel
        id={TERMINAL_PANEL_ID}
        style={{ backgroundColor: xtermBackground }}
        panelRef={panelRef}
        defaultSize={bottomOpen ? `${initialHeightPx}px` : 0}
        minSize="120px"
        maxSize="95%"
        collapsible
        collapsedSize={0}
        onResize={(size) => {
          const collapsed = size.asPercentage === 0;
          setIsCollapsed(collapsed);
          if (isDraggingRef.current) {
            if (collapsed && visible) onVisibleChange(false);
            else if (!collapsed && !visible) onVisibleChange(true);
            if (size.inPixels > 0) {
              heightPxRef.current = size.inPixels;
              debouncedWriteHeight(size.inPixels);
            }
          }
        }}
        inert={isCollapsed}
        className={cn(
          'flex flex-col',
          !isDragging &&
            'transition-[flex-grow] duration-150 ease-out motion-reduce:transition-none motion-reduce:duration-0',
        )}
      >
        {/* Mount point for the session host's stable host div when bottom-docked. */}
        <div ref={onBottomContainer} className="flex min-h-0 flex-1 flex-col overflow-hidden" />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
