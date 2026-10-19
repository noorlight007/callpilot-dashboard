/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // every page, but not /_next/static assets or files with an extension
        source: "/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
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
