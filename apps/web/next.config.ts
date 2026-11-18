import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@omnikit/shared"],
  serverExternalPackages: ["@electric-sql/pglite", "pg", "ioredis"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
