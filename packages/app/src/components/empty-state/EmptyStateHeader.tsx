import { OkBlob } from '@/components/OkBlob';

interface EmptyStateHeaderProps {
  /** Headline rendered as an h2. Keep it short and action-oriented; the blob
   *  carries the friendly greeting, so the headline doesn't need to. */
  readonly title: string;
  /** Optional one-line subtitle below the headline. Pass an explicit prop
   *  rather than children so the layout (blob | text-column) stays uniform
   *  across surfaces. */
  readonly subtitle?: string;
  /** Forwarded to OkBlob so the celebrate burst replays after a successful
   *  seed (or any other parent-triggered moment). Increment to fire. */
  readonly celebrateSignal: number;
}

/**
 * Shared header for the editor canvas's empty-state surfaces. Renders the
 * blob mascot beside a two-line title/subtitle column. Extracted so the
 * surfaces stay visually consistent and a future copy/spacing change lands in
 * one place.
 *
 * The blob sits in its own vertical slot (block-level) rather than inline-
 * flex with the text — see the EmptyEditorState rAF-driven 3D transform
 * comment for why mixing the two caused baseline jitter.
 */
export function EmptyStateHeader({ title, subtitle, celebrateSignal }: EmptyStateHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <OkBlob size={64} celebrateSignal={celebrateSignal} />
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-light tracking-tighter text-balance">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
