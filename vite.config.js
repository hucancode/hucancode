import { sveltekit } from "@sveltejs/kit/vite";
import { isoImport } from "vite-plugin-iso-import";
import Icons from "unplugin-icons/vite";
import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      $posts: path.resolve(__dirname, "./src/posts"),
      $styles: path.resolve(__dirname, "./src/styles"),
      $locales: path.resolve(__dirname, "./src/locales"),
    },
  },
  plugins: [
    sveltekit(),
    isoImport(),
    Icons({
      compiler: "svelte",
    }),
  ],
};

export default config;
