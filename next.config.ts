import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configure for Render deployment
  output: 'standalone',
};

export default nextConfig;
