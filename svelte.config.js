import adapter from "@sveltejs/adapter-static";
/** @type {import('@sveltejs/kit').Config} */

const config = {
  extensions: [".svelte"],

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
    adapter: adapter(),
  },
};

export default config;