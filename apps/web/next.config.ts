import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

// One .env at the repo root serves the web app, the seed scripts and Hardhat.
config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build run beside `next dev` without sharing the .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  poweredByHeader: false,
  // Evidence uploads go through server actions (default limit 1 MB). Matches the 4 MB file cap,
  // and stays under Vercel's 4.5 MB request limit.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
