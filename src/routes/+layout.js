import init from "$locales/i18n";

export const prerender = true;
export async function load() {
  await init();
}
