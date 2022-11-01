import React from "react";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";
import I18n from "locales/i18n";
import "styles/global.css";

export default async function RootLayout({ params, children }) {
  const { lang } = params;
  let dictionary = null;
  if (lang === "jp") {
    dictionary = (await import("locales/jp.json")).default;
    console.log("set language to JP");
  } else {
    dictionary = (await import("locales/en.json")).default;
    console.log("set language to EN");
  }
  return (
    <html>
      <body className="page-container">
        <I18n lngDict={dictionary} locale={lang}>
          <Navbar />
          <main>{children}</main>
          <FootNote />
        </I18n>
      </body>
    </html>
  );
}

export async function generateStaticParams() {
  const languages = ["en", "jp"];
  return languages.map((e) => ({
    lang: e,
  }));
}
