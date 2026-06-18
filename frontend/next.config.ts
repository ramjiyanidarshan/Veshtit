import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BACKEND_URL: (() => {
      let url = process.env.BACKEND_URL || "http://localhost:3001";
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }
      return url;
    })(),
  },
};

export default nextConfig;
