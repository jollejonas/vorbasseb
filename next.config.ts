import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "live-911-vorbasse-b-af-1912.umbraco-proxy.com" },
    ],
  },
};

export default nextConfig;
