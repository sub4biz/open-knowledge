'use client';

import { BookOpen, Menu, Star, X } from 'lucide-react';
import Link from 'next/link';
import type { FC, SVGProps } from 'react';
import { useEffect, useState } from 'react';
import { DiscordIcon } from '@/components/icons/discord';
import { GitHubIcon } from '@/components/icons/github';
import { XIcon } from '@/components/icons/x';
import { OkWordmark } from '@/components/ok-wordmark';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DOWNLOAD_ROUTE } from '@/lib/site';
import { MarketingButton } from './marketing-button';

type NavLink = {
  href: string;
  label: string;
  external: boolean;
  icon?: FC<SVGProps<SVGSVGElement>>;
  iconOnly?: boolean;
  desktopIconHidden?: boolean;
  showStars?: boolean;
};

const docsLink: NavLink = {
  href: '/docs',
  label: 'Docs',
  external: false,
  icon: BookOpen,
  desktopIconHidden: true,
};

const socialLinks: NavLink[] = [
  {
    href: 'https://x.com/OpenKnowledgeAI',
    label: 'X (Twitter)',
    external: true,
    icon: XIcon,
    iconOnly: true,
  },
  {
    href: 'https://discord.com/invite/YujKpFN49',
    label: 'Discord',
    external: true,
    icon: DiscordIcon,
    iconOnly: true,
  },
];

const githubLink: NavLink = {
  href: 'https://github.com/inkeep/open-knowledge',
  label: 'GitHub',
  external: true,
  icon: GitHubIcon,
  showStars: true,
};

const mobileLinks: NavLink[] = [docsLink, ...socialLinks, githubLink];

const starFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fullStarFormatter = new Intl.NumberFormat('en-US');

function NavLinkContent({ link, surface }: { link: NavLink; surface: 'desktop' | 'mobile' }) {
  const Icon = link.icon;
  const showIcon = !!Icon && (surface === 'mobile' || !link.desktopIconHidden);
  const showLabel = surface === 'mobile' || !link.iconOnly;
  return (
    <>
      {showIcon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {showLabel ? link.label : null}
    </>
  );
}

function NavItem({
  link,
  className,
  surface,
  onSelect,
}: {
  link: NavLink;
  className: string;
  surface: 'desktop' | 'mobile';
  onSelect?: () => void;
}) {
  const ariaLabel = surface === 'desktop' && link.iconOnly ? link.label : undefined;
  return link.external ? (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      onClick={onSelect}
      className={className}
    >
      <NavLinkContent link={link} surface={surface} />
    </a>
  ) : (
    <Link href={link.href} aria-label={ariaLabel} onClick={onSelect} className={className}>
      <NavLinkContent link={link} surface={surface} />
    </Link>
  );
}

function StarCount({ stars }: { stars: number }) {
  return (
    <>
      <Star
        className="size-3.5 shrink-0 text-golden-sun-300 fill-golden-sun-300"
        aria-hidden="true"
      />
      {starFormatter.format(stars)}
    </>
  );
}

function GitHubStarButton({
  link,
  stars,
  variant,
  onSelect,
}: {
  link: NavLink;
  stars: number | null;
  variant: 'pill' | 'row';
  onSelect?: () => void;
}) {
  const Icon = link.icon;
  const title = stars != null ? `${fullStarFormatter.format(stars)} GitHub stars` : undefined;

  if (variant === 'row') {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        title={title}
        onClick={onSelect}
        className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-slide-text transition-colors hover:bg-slide-bg-elevated"
      >
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
          {link.label}
        </span>
        {stars != null ? (
          <span className="flex items-center gap-1.5 tabular-nums text-slide-muted">
            <StarCount stars={stars} />
          </span>
        ) : null}
      </a>
    );
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-stretch overflow-hidden rounded-full border text-slide-muted hover:text-slide-text transition-colors hover:bg-slide-bg-elevated h-9"
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1.5">
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
        {link.label}
      </span>
      {stars != null ? (
        <span
          title={title}
          className="flex items-center gap-1.5 border-l px-2.5 py-1.5 tabular-nums"
        >
          <StarCount stars={stars} />
        </span>
      ) : null}
    </a>
  );
}

export function SiteNav({ stars }: { stars: number | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (mq.matches) setOpen(false);
    };
    closeOnDesktop();
    mq.addEventListener('change', closeOnDesktop);
    return () => mq.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-fd-background/80 backdrop-blur supports-backdrop-filter:bg-fd-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="OpenKnowledge home" className="inline-flex items-center">
            <OkWordmark aria-label="OpenKnowledge" className="h-8 w-auto text-slide-text" />
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 text-sm text-slide-muted md:flex uppercase font-mono"
          >
            <NavItem
              link={docsLink}
              surface="desktop"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-slide-text"
            />
          </nav>
        </div>

        <nav
          aria-label="Secondary"
          className="hidden items-center gap-6 text-sm text-slide-muted md:flex uppercase font-mono"
        >
          {socialLinks.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              surface="desktop"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-slide-text"
            />
          ))}
          <span aria-hidden="true" className="h-5 w-px bg-slide-border" />
          <GitHubStarButton link={githubLink} stars={stars} variant="pill" />
          <MarketingButton href={DOWNLOAD_ROUTE} size="sm">
            Download
          </MarketingButton>
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slide-muted opacity-60 transition-colors hover:bg-slide-bg-elevated hover:text-slide-text md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            aria-describedby={undefined}
            showCloseButton={false}
            className="border-t bg-fd-background md:hidden z-[1300]"
          >
            <SheetTitle className="sr-only">Site navigation</SheetTitle>
            <nav
              aria-label="Mobile"
              className="container mx-auto flex flex-col gap-1 px-6 pt-4 pb-6 text-base uppercase font-mono overscroll-contain"
            >
              <SheetClose asChild>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="mb-1 inline-flex h-10 w-10 items-center justify-center self-end rounded-md text-slide-muted opacity-60 transition-colors hover:bg-slide-bg-elevated hover:text-slide-text"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </SheetClose>
              {mobileLinks.map((link) =>
                link.showStars ? (
                  <GitHubStarButton
                    key={link.href}
                    link={link}
                    stars={stars}
                    variant="row"
                    onSelect={() => setOpen(false)}
                  />
                ) : (
                  <NavItem
                    key={link.href}
                    link={link}
                    surface="mobile"
                    onSelect={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-slide-text transition-colors hover:bg-slide-bg-elevated"
                  />
                ),
              )}
              <MarketingButton
                href={DOWNLOAD_ROUTE}
                size="md"
                className="text-base"
                showIcon
                onClick={() => setOpen(false)}
              >
                Download
              </MarketingButton>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
