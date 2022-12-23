export async function load({ url, params, fetch }) {
  const page = parseInt(params.page) || 1;
  const res = await fetch(`${url.origin}/blog/posts.json/${page}`);
  const data = await res.json();
  return data;
}
