import type { NextConfig } from "next";

// Reduce noisy "Invalid source map" warnings (especially common with Turbopack on Windows)
// and lower memory pressure during builds.
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    serverSourceMaps: false,
  },
  turbopack: {},
  webpack(config, { dev }) {
    // In dev, disable sourcemap generation to avoid noisy "Invalid source map" warnings
    // coming from dependencies on Windows.
    if (dev) config.devtool = false;
    return config;
  },
};

export default nextConfig;
