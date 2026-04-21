import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 uses native bindings; Next must not bundle it
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
