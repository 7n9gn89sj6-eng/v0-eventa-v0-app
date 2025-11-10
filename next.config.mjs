/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // async redirects() {
  //   return [
  //     {
  //       source: "/events/new",
  //       destination: "/add-event",
  //       permanent: false,
  //     },
  //   ]
  // },
}

export default nextConfig

