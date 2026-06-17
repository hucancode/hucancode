import { sveltekit } from "@sveltejs/kit/vite";
import { markdocPlugin } from "./src/lib/markdoc/vite-plugin.js";
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      $icons: path.resolve(__dirname, "./src/icons"),
      $styles: path.resolve(__dirname, "./src/styles"),
    },
  },
  plugins: [markdocPlugin(), sveltekit()],
};

export default config;
