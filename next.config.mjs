/** @type {import('next').NextConfig} */
const nextConfig = {
  // `npm run build:check` builds into .next-verify so a verification build
  // never overwrites the .next folder a running `next dev` is serving from.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
