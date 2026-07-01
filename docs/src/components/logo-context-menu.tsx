'use client';

import { ArrowRight, Check, Copy, Download } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { BRAND_ROUTE, PRIMARY_BRAND_ASSET } from '@/lib/brand-assets';
import { copySvgToClipboard } from '@/lib/copy-svg';

export function LogoContextMenu({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await copySvgToClipboard(PRIMARY_BRAND_ASSET.svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  }

  return (
    <>
      {/* Always-mounted live region so the copy confirmation is announced to
          screen readers — a text swap on the already-focused menu item isn't
          reliably announced on its own. */}
      <span className="sr-only" role="status">
        {copied ? 'Copied to clipboard' : ''}
      </span>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void copy();
            }}
          >
            {copied ? <Check className="text-slide-accent" /> : <Copy />}
            {copied ? 'Copied' : 'Copy as SVG'}
          </ContextMenuItem>
          <ContextMenuItem asChild>
            <a href={PRIMARY_BRAND_ASSET.svg} download={`${PRIMARY_BRAND_ASSET.downloadName}.svg`}>
              <Download />
              Download SVG
            </a>
          </ContextMenuItem>
          <ContextMenuItem asChild>
            <a href={PRIMARY_BRAND_ASSET.png} download={`${PRIMARY_BRAND_ASSET.downloadName}.png`}>
              <Download />
              Download PNG
            </a>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem asChild>
            <Link href={BRAND_ROUTE}>
              <ArrowRight />
              All brand assets
            </Link>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
