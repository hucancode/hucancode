"use client";
import { createContext, useContext } from "react";
import rosetta from "rosetta";

export const I18nContext = createContext();
const i18n = rosetta();

export default function I18n({ lang, dictionary, children }) {
  i18n.set(lang, dictionary);
  i18n.locale(lang);
  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
