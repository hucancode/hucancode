"use client";
import { createContext, useContext, useState } from "react";
import rosetta from "rosetta";
import EN from "locales/en.json";
import JP from "locales/jp.json";

export const I18nContext = createContext();
const i18n = rosetta();
i18n.set("en", EN);
i18n.set("jp", JP);
i18n.locale("en");
export default function I18n({ children }) {
  const [, setTick] = useState(0);
  const i18nWrapper = {
    t: (...args) => i18n.t(...args),
    locale: (l, dict) => {
      if (l == undefined) {
        return i18n.locale();
      }
      i18n.locale(l);
      if (dict) {
        i18n.set(l, dict);
      }
      setTick((tick) => tick + 1);
    },
  };
  return (
    <I18nContext.Provider value={i18nWrapper}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
