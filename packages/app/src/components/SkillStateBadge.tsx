import { Trans } from '@lingui/react/macro';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SkillStateBadge({
  installed,
  className,
  subtle = false,
}: {
  installed: boolean;
  className?: string;
  subtle?: boolean;
}) {
  const testId = installed ? 'skill-state-installed' : 'skill-state-draft';
  if (subtle) {
    return (
      <span
        className={cn(
          'text-2xs',
          installed ? 'text-primary/80' : 'text-muted-foreground/70',
          className,
        )}
        data-testid={testId}
      >
        {installed ? <Trans>Installed</Trans> : <Trans>Draft</Trans>}
      </span>
    );
  }
  return (
    <Badge variant={installed ? 'primary' : 'warning'} className={className} data-testid={testId}>
      {installed ? <Trans>Installed</Trans> : <Trans>Draft</Trans>}
    </Badge>
  );
}
