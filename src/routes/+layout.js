import { inject } from "@vercel/analytics";

export const prerender = true;
export async function load() {
  inject();
}
