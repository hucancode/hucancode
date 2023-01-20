import { randomThumbnail } from "$lib/utils";

export async function load({ params }) {
  try {
    const post = await import(`../../../../posts/${params.post}.md`);
    let ret = {
      content: post.default,
      meta: { ...post.metadata, slug: params.post },
    };
    return ret;
  } catch (err) {
    throw error(404, err);
  }
}
