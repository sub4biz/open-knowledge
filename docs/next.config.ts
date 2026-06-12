import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: {
    // Fail the build on any compiler diagnostic
    panicThreshold: 'all_errors',
  },
  // HSTS with `includeSubDomains; preload` (Vercel's injected default is
  // max-age only). Chrome blocks a download when ANY hop in its redirect
  // chain is plain http — so a visit starting at
  // http://openknowledge.ai/download/beta gets "Insecure download blocked"
  // for the DMG even though Vercel 308s to https immediately. Preload-list
  // membership (hstspreload.org) makes browsers rewrite to https before the
  // first request, removing the http hop entirely; the directives below are
  // the list's eligibility requirements. Subdomain-wide TLS is safe: DNS is
  // a wildcard onto Vercel and every host terminates TLS there.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // Redirects for deleted docs pages — the prior `Install` page was folded
  // into Quickstart when the docs pivoted to a desktop-app-first story.
  async redirects() {
    return [
      {
        source: '/docs/get-started/install',
        destination: '/docs/get-started/quickstart',
        permanent: true,
      },
      {
        source: '/docs/features/templates',
        destination: '/docs/advanced/folders-and-templates',
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
