import { error } from "@sveltejs/kit";

export async function load({ params, fetch }) {
  try {
    const res = await fetch(`/blog/post/${params.post}/json`);
    const data = await res.json();
    return data;
  } catch (err) {
    throw error(404, err);
  }
}
