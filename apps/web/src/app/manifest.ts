import type { MetadataRoute } from "next";

/** Lets phones install AthletiChain ("Add to Home Screen") and open it full screen, without browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AthletiChain",
    short_name: "AthletiChain",
    description: "Coach-verified, blockchain-anchored athlete records.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070d19",
    theme_color: "#070d19",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
