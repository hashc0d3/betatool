import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /** В dev запросы /api/* проксируются на Nest — cookie сессии на том же origin (localhost:3000). */
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:4001/:path*",
        },
        {
          source: "/uploads/:path*",
          destination: "http://127.0.0.1:4001/uploads/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
