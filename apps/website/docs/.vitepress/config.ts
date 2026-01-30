import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ChunkFlow Upload SDK",
  description:
    "A universal large file upload solution with chunked upload, resumable upload, and instant upload capabilities",
  lang: "en-US",
  lastUpdated: true,
  cleanUrls: true,
  base: process.env.NODE_ENV === "production" ? "/chunkflow/" : "/",

  head: [
    ["link", { rel: "icon", type: "image/png", href: "/logo.png" }],
    ["meta", { name: "theme-color", content: "#3eaf7c" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:locale", content: "en" }],
    ["meta", { name: "og:site_name", content: "ChunkFlow Upload SDK" }],
  ],

  themeConfig: {
    logo: "/logo.png",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/protocol" },
      { text: "Examples", link: "/examples/react" },
      { text: "GitHub", link: "https://github.com/Sunny-117/chunkflow" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is ChunkFlow?", link: "/guide/" },
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Upload Strategies", link: "/guide/upload-strategies" },
            { text: "Hash & Instant Upload", link: "/guide/hash-instant-upload" },
            { text: "Resumable Upload", link: "/guide/resumable-upload" },
            { text: "Dynamic Chunking", link: "/guide/dynamic-chunking" },
          ],
        },
        {
          text: "Configuration",
          items: [
            { text: "Client Configuration", link: "/guide/client-config" },
            { text: "Server Configuration", link: "/guide/server-config" },
            { text: "Storage Adapters", link: "/guide/storage-adapters" },
          ],
        },
        {
          text: "Best Practices",
          items: [
            { text: "Error Handling", link: "/guide/error-handling" },
            { text: "Performance Optimization", link: "/guide/performance" },
            { text: "Security", link: "/guide/security" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Protocol", link: "/api/protocol" },
            { text: "Shared", link: "/api/shared" },
            { text: "Core", link: "/api/core" },
            { text: "Client - React", link: "/api/client-react" },
            { text: "Client - Vue", link: "/api/client-vue" },
            { text: "Component - React", link: "/api/component-react" },
            { text: "Component - Vue", link: "/api/component-vue" },
            { text: "Server", link: "/api/server" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Examples",
          items: [
            { text: "React", link: "/examples/react" },
            { text: "Vue", link: "/examples/vue" },
            { text: "Server Integration", link: "/examples/server" },
            { text: "Custom Plugins", link: "/examples/plugins" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/Sunny-117/chunkflow" }],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026-present ChunkFlow Contributors",
    },

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/Sunny-117/chunkflow/edit/main/apps/website/docs/:path",
      text: "Edit this page on GitHub",
    },
  },
});
