import { sveltekit } from "@sveltejs/kit/vite";
import { threeMinifier } from "@yushijinhun/three-minifier-rollup";
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      $posts: path.resolve(__dirname, "./src/posts"),
      $icons: path.resolve(__dirname, "./src/icons"),
      $styles: path.resolve(__dirname, "./src/styles"),
      $locales: path.resolve(__dirname, "./src/locales"),
    },
  },
  plugins: [sveltekit(), { ...threeMinifier(), enforce: "pre" }],
};

export default config;
