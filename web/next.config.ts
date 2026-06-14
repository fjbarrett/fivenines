import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /cdn is an alias for the canonical /cdns page
      { source: "/cdn", destination: "/cdns", permanent: true },
    ];
  },
};

export default nextConfig;
