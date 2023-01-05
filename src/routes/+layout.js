import init from "$locales/i18n";
import { inject } from "@vercel/analytics";

export const prerender = true;
export async function load() {
  await init();
  inject();
}
