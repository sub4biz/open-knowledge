import type { MetadataRoute } from 'next';
import { BRAND_ROUTE } from '@/lib/brand-assets';
import { SITE_URL } from '@/lib/site';
import { source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  const docPages = source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}${BRAND_ROUTE}`, changeFrequency: 'monthly', priority: 0.4 },
    ...docPages,
  ];
}
