import fetchPosts, { fetchPageCount } from "$lib/blog/fetch";
import { json } from "@sveltejs/kit";

export const prerender = true;

export async function GET({ params }) {
  const category = params.category || "";
  let page = parseInt(params.page) || 1;
  const lastPage = await fetchPageCount({ category });
  page = Math.min(page, lastPage);
  const { posts } = await fetchPosts({ category, page });
  return json({ category, lastPage, page, posts });
}
