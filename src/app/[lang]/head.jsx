"use client";
import { contentLanguageMap } from "locales/i18n";

export default function Head({ lang }) {
  return (
    <>
      <title>hucancode</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      <meta httpEquiv="content-language" content={contentLanguageMap[lang]} />
    </>
  );
}
