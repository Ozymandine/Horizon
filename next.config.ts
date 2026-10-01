import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Local dev often runs behind a network proxy that cannot fetch remote artwork.
    // Let the browser fetch images directly there; keep production optimization enabled.
    unoptimized: process.env.NODE_ENV !== "production",
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "**.steamstatic.com" },
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "media.rawg.io" },
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "**.scdn.co" },
      { protocol: "https", hostname: "**.spotifycdn.com" },
      { protocol: "https", hostname: "**.mzstatic.com" },
      { protocol: "https", hostname: "images.gog-statics.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

export default nextConfig;
