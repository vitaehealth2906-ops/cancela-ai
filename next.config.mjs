/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @anthropic-ai/sdk roda mais estável como dependência externa do bundle.
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
};

export default nextConfig;
