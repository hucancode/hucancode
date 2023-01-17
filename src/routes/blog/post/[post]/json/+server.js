import { json } from "@sveltejs/kit";
export async function GET({ params }) {
  // ugly i know, but we can't import($posts/${params.post}.md`);
  const post = await import(`../../../../../posts/${params.post}.md`);
  let ret = {
    content: post.default.render().html,
    meta: { ...post.metadata, slug: params.post },
  };
  ret.meta.cover =
    ret.meta.cover ??
    `https://picsum.photos/seed/${ret.meta.slug}/${1024}/${Math.floor(
      (1024 * 16) / 9
    )}`;
  return json(ret);
}
