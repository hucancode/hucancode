export async function load({ fetch }) {
  const res = await fetch("/leetcode");
  const data = await res.json();
  return data;
}
