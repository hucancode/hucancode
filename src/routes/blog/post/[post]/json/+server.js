import { json } from "@sveltejs/kit";
export async function GET({ params }) {
  // ugly i know, but we can't import($posts/${params.post}.md`);
  const post = await import(`../../../../../posts/${params.post}.md`);
  const ret = {
    content: post.default.render().html,
    meta: { ...post.metadata, slug: params.post },
  };
  return json(ret);
}
