import type { NextConfig } from "next";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enable static export for Capacitor builds (native apps)
  ...(isCapacitorBuild && {
    output: "export",
    // Use trailing slashes to generate /page/index.html instead of /page.html
    // This is required for Capacitor's WebView to handle client-side routing properly
    trailingSlash: true,
  }),
  // Explicitly use webpack for WASM support (Turbopack doesn't fully support WASM yet)
  webpack: (config, { isServer }) => {
    // Enable WASM support (client-side only)
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };

      // Handle WASM files (client-side only)
      config.module.rules.push({
        test: /\.wasm$/,
        type: "asset/resource",
      });
    }

    return config;
  },
  // Add empty turbopack config to silence warning (we're using webpack)
  turbopack: {},
};

export default nextConfig;
