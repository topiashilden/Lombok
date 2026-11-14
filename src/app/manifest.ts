import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solvo",
    short_name: "Solvo",
    description: "Fixed costs aren't fixed.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f4f1",
    theme_color: "#f2f4f1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
