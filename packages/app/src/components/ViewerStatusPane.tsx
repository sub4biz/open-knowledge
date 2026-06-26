import { Trans } from '@lingui/react/macro';

interface ViewerStatusPaneBaseProps {
  fileName: string;
  dataAttr: string;
  extraAttrs?: Record<string, string>;
}

export function ViewerLoadingPane({ fileName, dataAttr, extraAttrs }: ViewerStatusPaneBaseProps) {
  return (
    <main
      className="flex h-full min-h-0 flex-col items-center justify-center bg-background text-muted-foreground text-sm"
      aria-label={fileName}
      {...{ [dataAttr]: '', [`${dataAttr}-state`]: 'loading' }}
      {...extraAttrs}
    >
      <span>
        <Trans>Loading {fileName}</Trans>
      </span>
    </main>
  );
}

export function ViewerErrorPane({
  fileName,
  dataAttr,
  extraAttrs,
  message,
  openHref,
}: ViewerStatusPaneBaseProps & {
  message: string;
  openHref?: string;
}) {
  return (
    <main
      className="flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-background p-4 text-center"
      aria-label={fileName}
      {...{ [dataAttr]: '', [`${dataAttr}-state`]: 'error' }}
      {...extraAttrs}
    >
      <div className="font-medium text-sm">
        <Trans>Couldn't load {fileName}</Trans>
      </div>
      <div className="text-muted-foreground text-xs">{message}</div>
      {openHref ? (
        <a
          href={openHref}
          className="mt-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <Trans>Open file</Trans>
        </a>
      ) : null}
    </main>
  );
}
