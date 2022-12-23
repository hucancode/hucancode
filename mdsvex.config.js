import remarkMath from "remark-math";
import rehypeKatexSvelte from "rehype-katex-svelte";
import { defineMDSveXConfig as defineConfig } from "mdsvex";

const config = defineConfig({
  extensions: [".svelte.md", ".md", ".svx"],

  smartypants: {
    dashes: "oldschool",
  },

  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatexSvelte],
});

export default config;
