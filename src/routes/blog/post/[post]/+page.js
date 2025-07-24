import { error } from '@sveltejs/kit';

export async function load({ params }) {
  try {
    const post = await import(`../../../../posts/${params.post}.md`);
    return {
      content: post.default,
      meta: { ...post.metadata, slug: params.post },
    };
  } catch (err) {
    throw error(404, err);
  }
}
