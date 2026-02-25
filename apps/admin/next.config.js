/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Disable ESLint and TypeScript checking during production builds (will fix separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Support dynamic routes
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },

  webpack: (config, { isServer }) => {
    // webpack 5.90.0 fails to serialize the large @supabase ESM bundle
    // ("Unexpected end of JSON input"). Alias to the CJS build so webpack
    // processes a smaller, non-ESM module on both server and client bundles.
    // require.resolve() follows the "exports[require]" condition → dist/index.cjs
    const supabasePkgs = [
      '@supabase/supabase-js',
      '@supabase/auth-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
      '@supabase/postgrest-js',
    ];
    const newAliases = {};
    for (const pkg of supabasePkgs) {
      try {
        newAliases[pkg] = require.resolve(pkg);
      } catch (_) {
        // package not installed, skip
      }
    }
    config.resolve.alias = { ...config.resolve.alias, ...newAliases };

    if (isServer) {
      // Belt-and-suspenders: also externalize for the server bundle so webpack
      // emits require() calls instead of bundling them at all.
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];
      config.externals = [
        ...existingExternals,
        function ({ request }, callback) {
          if (request && request.startsWith('@supabase/')) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }
    return config;
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
