"use client";
import { createContext, useContext } from "react";
import rosetta from "rosetta";
import EN from "locales/en.json";
import JP from "locales/jp.json";

export const I18nContext = createContext();
const i18n = rosetta();

export default function I18n({ children }) {
  i18n.set('en', EN);
  i18n.set('jp', JP);
  i18n.locale('en');
  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
