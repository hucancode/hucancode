import { sveltekit } from "@sveltejs/kit/vite";
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      $posts: path.resolve(__dirname, "./src/posts"),
      $styles: path.resolve(__dirname, "./src/styles"),
      $locales: path.resolve(__dirname, "./src/locales"),
      $shoelace: path.resolve(
        __dirname,
        "./node_modules/@shoelace-style/shoelace/dist/components"
      ),
    },
  },
  plugins: [sveltekit()],
};

export default config;
