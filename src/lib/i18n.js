import { derived, writable, readable } from "svelte/store";
import * as en from "$locales/en.json";
import * as ja from "$locales/ja.json";
import * as mini from "$locales/mini.json";

const DICT = { en, ja, mini };
const FALLBACK_LANG = "en";
export const locale = writable("en");
export const locales = Object.keys(DICT);

function translate(locale, key, vars) {
  if (!(locale in DICT)) {
    locale = FALLBACK_LANG;
  }
  let text = DICT[locale];
  for (const k of key.split(".")) {
    if (k in text) {
      text = text[k];
    } else {
      return key;
    }
  }
  Object.keys(vars).map((k) => {
    const regex = new RegExp(`{{${k}}}`, "g");
    text = text.replace(regex, vars[k]);
  });
  return text;
}

export const _ = derived(
  locale,
  ($locale) =>
    (key, vars = {}) =>
      translate($locale, key, vars)
);

export function formatDateRelative(locale, date) {
  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });
  const DIVISIONS = [
    { amount: 60, name: "seconds" },
    { amount: 60, name: "minutes" },
    { amount: 24, name: "hours" },
    { amount: 7, name: "days" },
    { amount: 4.34524, name: "weeks" },
    { amount: 12, name: "months" },
    { amount: Number.POSITIVE_INFINITY, name: "years" },
  ];
  let duration = (date - new Date()) / 1000;
  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
  return date;
}
