import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Veshtit",
    short_name: "Veshtit",
    description: "Securely manage your digital accounts with AES-256 encryption.",
    start_url: "/accounts",
    scope: "/",
    display: "standalone",
    background_color: "#0a0b13",
    theme_color: "#FF6B35",
    orientation: "any",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
