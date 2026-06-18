import { FolderIcon, GitBranchIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OkWordmark } from '@/components/ok-wordmark';
import { buildSplashViewModel, SPLASH_DOWNLOAD_URL } from '@/lib/share-splash';
import { SITE_URL } from '@/lib/site';
import { DotTexture } from '../../(home)/dot-texture';
import { SplashButtonLabel, splashOutlineButton, splashPrimaryButton } from './splash-buttons';
import { SplashCtaCluster } from './splash-cta-cluster';

export const dynamic = 'force-static';

interface SplashPageProps {
  params: Promise<{ encoded: string }>;
}

export async function generateMetadata({ params }: SplashPageProps): Promise<Metadata> {
  const { encoded } = await params;
  const view = buildSplashViewModel(encoded);

  if (view.kind !== 'ok') {
    return {
      title: { absolute: 'Open Knowledge' },
      description: 'Open in Open Knowledge.',
      robots: { index: false, follow: true },
    };
  }

  return {
    title: view.filename,
    description: 'Open in Open Knowledge.',
    robots: { index: false, follow: true },
    openGraph: {
      title: view.filename,
      description: 'Open in Open Knowledge.',
      url: `${SITE_URL}/d/${encoded}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: view.filename,
      description: 'Open in Open Knowledge.',
    },
  };
}

export default async function SplashPage({ params }: SplashPageProps) {
  const { encoded } = await params;
  const view = buildSplashViewModel(encoded);

  if (view.kind === 'unsupported-version') {
    return <SplashFallback heading="Update Open Knowledge to open this share." />;
  }

  if (view.kind === 'invalid') {
    return <SplashFallback heading="Invalid share URL." />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slide-bg font-[family-name:var(--font-dm-sans)]">
      <SplashChrome />

      <section className="relative z-10 px-4 pt-16 pb-16 md:pt-24 md:pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-6 font-mono text-base font-medium uppercase tracking-wide text-primary">
            {view.target === 'folder' ? 'Shared folder' : 'Shared'}
          </p>

          <h1
            className="text-3xl font-light tracking-tight text-slide-text sm:text-4xl lg:text-[3.25rem] lg:leading-[1.1]"
            data-testid="splash-filename"
          >
            <span className="relative inline-block break-words">
              {view.filename}
              <svg
                className="absolute -bottom-2 left-0 h-3 w-full"
                viewBox="0 0 286 14"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M3 11C45 3.5 91.5 1.5 143 5.5C194.5 9.5 241 7 283 3"
                  stroke="var(--slide-accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p
            className="mt-8 text-lg leading-relaxed text-slide-muted"
            data-testid="splash-repo-path"
          >
            {view.repoPath}
          </p>

          {view.target === 'folder' ? (
            <p
              className="mt-2 inline-flex items-center gap-2 text-sm text-slide-muted"
              data-testid="splash-folder-indicator"
            >
              <FolderIcon className="size-4" aria-hidden="true" />
              <span>Folder</span>
            </p>
          ) : null}

          {view.isDefaultBranch ? null : (
            <p
              className="mt-2 inline-flex items-center gap-2 text-sm text-slide-muted"
              data-testid="splash-branch-indicator"
            >
              <GitBranchIcon className="size-4" aria-hidden="true" />
              <span>
                on <span className="font-medium text-slide-text">{view.branch}</span>
              </span>
            </p>
          )}

          <SplashCtaCluster
            downloadUrl={`/d/${encoded}/download`}
            customSchemeUrl={view.customSchemeUrl}
            githubUrl={view.githubUrl}
          />
        </div>
      </section>
    </main>
  );
}

function SplashChrome() {
  return (
    <>
      <DotTexture
        variant="right"
        priority
        className="top-0 right-0 w-60 dark:opacity-30 sm:w-[680px]"
      />
      <DotTexture
        variant="left"
        className="bottom-0 left-0 w-40 dark:opacity-30 sm:w-72 lg:w-[515px]"
      />
      <header className="relative z-10 px-4">
        <div className="mx-auto flex max-w-5xl pt-8 md:pt-10">
          <Link href="/" aria-label="Open Knowledge home" className="inline-flex items-center">
            {/* Link already names the control; hide the wordmark's own label to
                avoid a doubled "Open Knowledge" announcement. */}
            <OkWordmark aria-hidden="true" className="h-8 w-auto text-slide-text" />
          </Link>
        </div>
      </header>
    </>
  );
}

function SplashFallback({ heading }: { heading: string }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slide-bg font-[family-name:var(--font-dm-sans)]">
      <SplashChrome />

      <section className="relative z-10 px-4 pt-16 pb-16 md:pt-24 md:pb-20">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-light tracking-tight text-slide-text sm:text-4xl">
            {heading}
          </h1>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a href={SPLASH_DOWNLOAD_URL} className={splashPrimaryButton}>
              <SplashButtonLabel direction="down">Download for macOS</SplashButtonLabel>
            </a>
            <Link href="/" className={splashOutlineButton}>
              <SplashButtonLabel iconStyle="plain">Learn more</SplashButtonLabel>
            </Link>
          </div>

          <p className="mt-8 text-sm text-slide-muted">Share URLs are only opened on macOS.</p>
        </div>
      </section>
    </main>
  );
}
