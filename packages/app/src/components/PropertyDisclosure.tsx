import { ChevronRight } from 'lucide-react';
import { type ReactNode, type Ref, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function PropertyDisclosure({
  title,
  className,
  testId,
  open: openProp,
  onOpenChange,
  children,
  ref,
}: {
  title: ReactNode;
  className?: string;
  testId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** Forwarded to the container element — e.g. so a selection-publishing hook
   *  can observe text selection within the panel. React 19 ref-as-prop. */
  ref?: Ref<HTMLDivElement>;
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const open = openProp ?? !internalCollapsed;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalCollapsed(!next);
  };
  return (
    <div
      ref={ref}
      className={cn('property-panel editor-content-aligned text-sm', className)}
      data-testid={testId}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="mb-1.5 flex h-auto w-fit items-center gap-1 bg-transparent! px-1 py-0.5 text-base font-medium text-foreground hover:bg-transparent hover:text-foreground"
          >
            <ChevronRight
              data-expanded={open}
              className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out data-[expanded=true]:rotate-90"
            />
            <span>{title}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_150ms_ease-out] data-[state=closed]:animate-[collapsible-up_150ms_ease-in]">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
