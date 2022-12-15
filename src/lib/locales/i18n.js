import { locale, register, init as initI18n, waitLocale } from "svelte-i18n";
import { browser } from "$app/environment";

const defaultLocale = "en";

export default async function init() {
  register("en", () => import("$lib/locales/en.json"));
  register("ja", () => import("$lib/locales/ja.json"));
  let initialLocale = defaultLocale;
  if (browser) {
    const params = new URLSearchParams(window.location.search);
    let lang = params.get("lang");
    if (!lang) {
      lang = window.navigator.language;
    }
    locale.set(lang);
    initialLocale = lang;
  }
  await initI18n({
    fallbackLocale: defaultLocale,
    initialLocale: initialLocale,
  });
  await waitLocale();
}
