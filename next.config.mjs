/** @type {import('next').NextConfig} */
const nextConfig = {
  // This folder is the project root, even if a parent folder has its own lockfile.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname
};

export default nextConfig;
