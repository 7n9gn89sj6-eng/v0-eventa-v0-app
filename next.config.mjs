/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove old/deprecated ESLint config
  // Next.js 16 no longer supports custom eslint options here.

  reactStrictMode: true,

  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000"],
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
}

export default nextConfig
