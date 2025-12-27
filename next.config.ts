import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental WebAssembly support
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Enable Turbopack with empty config to silence the warning
  // and configure webpack for WASM files when using webpack build
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Add rule for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Exclude essentia.js from server-side bundling (it's browser-only)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'essentia.js': 'essentia.js',
      });
    }

    return config;
  },
};

export default nextConfig;
