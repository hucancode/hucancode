import fetchPosts, { fetchPageCount, fetchAllCategories } from "$lib/blog/fetch";
import { json } from "@sveltejs/kit";

export async function GET({ params }) {
  const lastPage = await fetchPageCount();
  let page = parseInt(params.page) || 1;
  page = Math.min(page, lastPage);
  const { posts } = await fetchPosts({ page });
  const categories = page === 1 ? await fetchAllCategories() : [];
  return json({ lastPage, page, posts, categories });
}
