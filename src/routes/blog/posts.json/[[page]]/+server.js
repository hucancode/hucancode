import fetchPosts, { fetchPageCount } from "$lib/blog/fetch";
import { json } from "@sveltejs/kit";

export const prerender = true;

export async function GET({ params }) {
  const lastPage = await fetchPageCount();
  let page = parseInt(params.page) || 1;
  page = Math.min(page, lastPage);
  const { posts } = await fetchPosts({ page });
  return json({ lastPage, page, posts });
}
