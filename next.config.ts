import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Creative images are served from the Supabase storage bucket, which must
  // stay public-read because Meta fetches these URLs server-side.
  // See docs/SPEC.md §9 rule 12.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
