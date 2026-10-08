/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
    staticIndicator: false,
  },
  async headers() {
    return [
      {
        // every page, but not /_next/static assets or files with an extension
        source: "/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/((?!login).*)",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
}

export default nextConfig
