import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const isCI = process.env.CI === "true"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint is now configured via .eslintrc.json and runs via `next lint` command
  typescript: {
    ignoreBuildErrors: !isCI,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/events/new",
        destination: "/add-event",
        permanent: false,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
