import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.tcgdex.net" },
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
