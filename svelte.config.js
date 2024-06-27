import { mdsvex } from "mdsvex";
import mdsvexConfig from "./mdsvex.config.js";
import adapter from "@sveltejs/adapter-static";
/** @type {import('@sveltejs/kit').Config} */

const config = {
  extensions: [".svelte", ...mdsvexConfig.extensions],

  kit: {
    csp: {
      directives: {
        "default-src": ["self"],
        "img-src": ["self", "blob:", "https:"],
        "script-src": ["self", "googletagmanager.com", "www.googletagmanager.com"],
        "connect-src": ["self", "data:", "blob:"],
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
