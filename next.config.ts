import type {NextConfig} from 'next';

// BUILD_MOBILE=true -> static export (out/) bundled into the Android APK
// BUILD_PAGES=true  -> static export for GitHub Pages (sub-path aware)
// otherwise          -> standalone server build (.next/) for web hosting
const isMobile = process.env.BUILD_MOBILE === 'true';
const isPages = process.env.BUILD_PAGES === 'true';
const isExport = isMobile || isPages;
const basePath = isPages ? '/synaa-studio' : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: isExport ? 'export' : 'standalone',
  assetPrefix: isPages ? `${basePath}/` : isMobile ? '/' : undefined,
  basePath,
  trailingSlash: isExport ? true : undefined,
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
