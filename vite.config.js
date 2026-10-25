import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { markdocPlugin } from "./src/lib/markdoc/vite-plugin.js";
import { wgslPlugin } from "./src/lib/engine/gpu/vite-plugin-wgsl.js";
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      $icons: path.resolve(import.meta.dirname, "./src/icons"),
      $styles: path.resolve(import.meta.dirname, "./src/styles"),
    },
  },
  plugins: [
    wgslPlugin(),
    markdocPlugin(),
    sveltekit({
      extensions: [".svelte"],
      csp: {
        directives: {
          "default-src": ["self"],
          "img-src": [
            "self",
            "https:",
            "blob:",
            "https://*.google-analytics.com",
            "https://*.googletagmanager.com",
            "https://*.google.com",
            "https://*.g.doubleclick.net",
          ],
          "script-src": [
            "self",
            "unsafe-eval",
            "https://*.googletagmanager.com",
          ],
          "connect-src": [
            "self",
            "data:",
            "blob:",
            "https://*.google-analytics.com",
            "https://*.analytics.google.com",
            "https://*.googletagmanager.com",
            "https://*.google.com",
            "https://*.g.doubleclick.net",
          ],
          "frame-src": ["*.doubleclick.net"],
          "style-src": ["self", "unsafe-inline", "fonts.googleapis.com"],
          "font-src": ["self", "data:", "fonts.gstatic.com"],
        },
      },
      adapter: adapter(),
    }),
  ],
};

export default config;
