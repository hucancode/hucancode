import { json } from "@sveltejs/kit";
import { randomThumbnail } from "$lib/server/thumbnail";
export async function GET({ params }) {
  // ugly i know, but we can't import($posts/${params.post}.md`);
  const post = await import(`../../../../../posts/${params.post}.md`);
  const ret = {
    content: post.default.render().html,
    meta: { ...post.metadata, slug: params.post },
  };
  if (!ret.meta.cover) {
    ret.meta.cover = await randomThumbnail(ret.meta.slug);
  }
  return json(ret);
}
