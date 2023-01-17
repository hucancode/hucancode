import { json } from "@sveltejs/kit";
import { randomThumbnail } from "$lib/utils"
export async function GET({ params }) {
  // ugly i know, but we can't import($posts/${params.post}.md`);
  const post = await import(`../../../../../posts/${params.post}.md`);
  let ret = {
    content: post.default.render().html,
    meta: { ...post.metadata, slug: params.post },
  };
    if(!ret.meta.cover) {
        ret.meta.cover = await randomThumbnail(ret.meta.slug);
    }
  return json(ret);
}
