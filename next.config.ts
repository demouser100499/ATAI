import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Silence Turbopack/Webpack conflict by setting empty turbopack config
  // and removing custom webpack config (we will fix the dependency issue by switching to hyparquet)
  turbopack: {},
};

export default nextConfig;
