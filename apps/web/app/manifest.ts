import type { MetadataRoute } from "next";

/** Lets the Remote page be added to a phone's home screen (decisions §64.10). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Titan117 Remote",
    short_name: "Titan117",
    description: "Start tasks and answer approvals on your laptop from your phone.",
    start_url: "/remote",
    scope: "/remote",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ff6347",
    icons: [{ src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
