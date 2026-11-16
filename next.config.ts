import type { NextConfig } from "next";

/** Express API origin (server-side proxy target). */
const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /**
   * The React frontend talks to the Express REST API. Requests stay same-origin
   * (so the httpOnly session cookie works) and are proxied to the API server.
   */
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
