import remarkMath from "remark-math";
import rehypeKatexSvelte from "rehype-katex-svelte";
import { defineMDSveXConfig } from "mdsvex";

const config = defineMDSveXConfig({
  extensions: [".svelte.md", ".md", ".svx"],
  layout: {
    blog: "src/routes/blog/post/layout.svelte",
  },
  smartypants: {
    dashes: "oldschool",
  },

  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatexSvelte],
});

export default config;
