export default function manifest() {
  return {
    id: "/create",
    name: "String Art Dnipro",
    short_name: "String Art",
    description: "Create detailed String Art patterns from your photos.",
    start_url: "/create",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Create pattern",
        short_name: "Create",
        url: "/create",
        icons: [
          {
            src: "/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Build mode",
        short_name: "Build",
        url: "/build",
        icons: [
          {
            src: "/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
