// frontend/next.config.ts

import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Let other devices on the local network (e.g. the caller's laptop or phone in
// a demo) use the dev server through this machine's LAN addresses.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: lanAddresses,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
