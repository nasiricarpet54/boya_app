const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Served under the /admin subpath in production (see Caddyfile `handle /admin*`).
  // `assetPrefix` keeps `/_next/*` URLs prefixed the same way; Next applies
  // basePath to assets automatically, the explicit prefix just makes it obvious.
  basePath: '/admin',
  assetPrefix: '/admin',
  // `moment-jalaali` ships an ESM build that Next resolves fine, but the
  // package also carries a `.mjs` entry that must stay outside the server
  // bundle's `require` graph. Nothing else is needed today; the hook is left
  // in place so a future native/wasm date dependency has an obvious home.
  webpack: (config) => config,
};

module.exports = withNextIntl(nextConfig);
