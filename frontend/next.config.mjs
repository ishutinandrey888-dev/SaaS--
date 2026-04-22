/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Ship a minimal server bundle (node_modules pruned to what's
  // actually imported) so the Docker image stays small.
  output: "standalone",
};

export default nextConfig;
