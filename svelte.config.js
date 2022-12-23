import { mdsvex } from "mdsvex";
import mdsvexConfig from "./mdsvex.config.js";
import preprocess from "svelte-preprocess";
import adapter from "@sveltejs/adapter-vercel";
/** @type {import('@sveltejs/kit').Config} */

const config = {
  extensions: [".svelte", ...mdsvexConfig.extensions],

  kit: {
    csp: {
      directives: {
        "default-src": ["self"],
        "img-src": ["self", "blob:", "https:"],
        "script-src": ["self"],
        "connect-src": ["self", "blob:", "vitals.vercel-insights.com"],
        "style-src": ["self", "unsafe-inline", "fonts.googleapis.com"],
        "font-src": ["self", "data:", "fonts.gstatic.com"],
      },
    },
    adapter: adapter({
      strict: false,
    }),
  },

  preprocess: [preprocess({ postcss: true }), mdsvex(mdsvexConfig)],
};

export default config;
