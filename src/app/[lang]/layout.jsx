export const dynamic = "force-static";
import React from "react";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";
import I18n from "locales/i18n";
import languages from "locales/supported-languages";
import "styles/global.css";

export default async function RootLayout({ params, children }) {
  const { lang } = params;
  if (!languages.includes(lang)) {
    throw new Error("Language not found");
  }
  console.log(`rendering RootLayout, lang = ${lang}`);
  const data = await import(`locales/${lang}.json`);
  if (!data) {
    throw new Error(`Data for ${lang} not found`);
  }
  let dictionary = data.default;
  return (
    <html lang={lang}>
      <body className="page-container">
        <I18n lang={lang} dictionary={dictionary}>
          <Navbar />
          <main>{children}</main>
          <FootNote />
        </I18n>
      </body>
    </html>
  );
}

export async function generateStaticParams() {
  return languages.map((e) => ({
    lang: e,
  }));
}
