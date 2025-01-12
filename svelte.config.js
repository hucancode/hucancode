import { mdsvex } from "mdsvex";
import mdsvexConfig from "./mdsvex.config.js";
import adapter from "@sveltejs/adapter-auto";
/** @type {import('@sveltejs/kit').Config} */

const config = {
  extensions: [".svelte", ...mdsvexConfig.extensions],

  kit: {
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
        "script-src": ["self", "unsafe-eval", "https://*.googletagmanager.com"],
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
    adapter: adapter({
      strict: false,
    }),
  },

  preprocess: [mdsvex(mdsvexConfig)],
};

export default config;
