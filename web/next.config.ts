import type { NextConfig } from "next";

// Reduce noisy "Invalid source map" warnings (especially common with Turbopack on Windows)
// and lower memory pressure during builds.
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    serverSourceMaps: false,
  },
};

export default nextConfig;
