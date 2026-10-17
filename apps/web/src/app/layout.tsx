import type { Metadata, Viewport } from "next";
// Self-hosted fonts: no request to Google at runtime, works offline and on Vercel.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AthletiChain — Track. Verify. Improve.", template: "%s · AthletiChain" },
  description: "Coach-verified, blockchain-anchored athlete records that travel with the athlete.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070d19",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
