import type { Metadata } from 'next';
import { BRAND_ASSETS, BRAND_ROUTE, BRAND_ZIP } from '@/lib/brand-assets';
import { cn } from '@/lib/utils';
import { SiteFooter } from '../footer';
import { MarketingButton } from '../marketing-button';
import SectionHeading from '../section-heading';

export const metadata: Metadata = {
  title: 'Brand assets',
  description:
    'Download the OpenKnowledge logo and icon — SVG and PNG, for light and dark backgrounds.',
  alternates: { canonical: BRAND_ROUTE },
};

export default function BrandPage() {
  return (
    <div className="font-[family-name:var(--font-dm-sans)] selection:bg-[var(--slide-accent)]/20">
      <section className="container mx-auto px-6 py-16 sm:py-24">
        <SectionHeading
          tag="Brand"
          description="Download the official OpenKnowledge logos and brand assets for press, partnerships, or just to share about us."
          className="max-w-2xl"
        >
          Logo & brand assets
        </SectionHeading>

        <div className="mt-8">
          <MarketingButton href={BRAND_ZIP} download="openknowledge-brand.zip" className="w-fit">
            Download all
          </MarketingButton>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BRAND_ASSETS.map((asset) => (
            <div
              key={asset.id}
              className={cn(
                'relative flex h-52 items-center justify-center overflow-hidden rounded-2xl px-8',
                asset.tile === 'brand' && 'bg-azure-blue',
                asset.tile === 'white' && 'bg-white',
                asset.tile === 'muted' && 'bg-slide-text/[0.04]',
              )}
            >
              {/* biome-ignore lint: static same-origin SVG preview; next/image would need dangerouslyAllowSVG and fixed dimensions. */}
              <img
                src={asset.svg}
                alt={asset.alt}
                className={cn('h-auto w-auto', asset.id === 'icon' ? 'max-h-28' : 'max-h-14')}
              />
              <div className="absolute right-4 bottom-4 flex gap-2">
                <MarketingButton
                  href={asset.svg}
                  download={`${asset.downloadName}.svg`}
                  variant="tertiary"
                  size="sm"
                >
                  <span className="sr-only">{asset.alt} </span>SVG
                </MarketingButton>
                <MarketingButton
                  href={asset.png}
                  download={`${asset.downloadName}.png`}
                  variant="tertiary"
                  size="sm"
                >
                  <span className="sr-only">{asset.alt} </span>PNG
                </MarketingButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter showSubscribe={false} />
    </div>
  );
}
