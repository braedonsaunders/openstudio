import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental WebAssembly support
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Security and COOP/COEP headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Required for SharedArrayBuffer (ultra-low-latency audio)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Using credentialless instead of require-corp for better compatibility
          // with third-party resources (fonts, analytics, etc.)
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },

          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        ],
      },
      // Additional security for API routes
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
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
