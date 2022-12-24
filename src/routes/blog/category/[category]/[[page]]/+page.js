export const prerender = true;

export async function load({ url, params, fetch }) {
  const page = parseInt(params.page) || 1;
  const category = params.category || "";
  const res = await fetch(`/blog/category/${category}/posts.json/${page}`);
  const data = await res.json();
  return data;
}
