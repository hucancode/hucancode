import { sveltekit } from "@sveltejs/kit/vite";
import { markdocPlugin } from "./src/lib/markdoc/vite-plugin.js";
import { wgslPlugin } from "./src/lib/engine/gpu/vite-plugin-wgsl.js";
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      $icons: path.resolve(__dirname, "./src/icons"),
      $styles: path.resolve(__dirname, "./src/styles"),
    },
  },
  plugins: [wgslPlugin(), markdocPlugin(), sveltekit()],
};

export default config;
