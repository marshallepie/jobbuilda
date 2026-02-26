/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    missingSuspenseWithCSRBailout: false,
  },

  webpack: (config, { isServer }) => {
    // webpack 5.90.0 fails to serialize the large @supabase ESM bundle.
    // Alias to the CJS build on both server and client.
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
      } catch (_) {}
    }
    config.resolve.alias = { ...config.resolve.alias, ...newAliases };

    if (isServer) {
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

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
