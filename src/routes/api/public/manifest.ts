import { createFileRoute } from "@tanstack/react-router";

const manifest = {
  name: "Campus Zen",
  short_name: "CampusZen",
  description:
    "Track assignments, attendance and exams, save study resources, and get AI-generated study plans in one place.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#6D28D9",
  orientation: "portrait-primary",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export const Route = createFileRoute("/api/public/manifest")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(manifest), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});
