export const dynamic = "force-static";
import React from "react";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";
import I18n from "locales/i18n";
import "styles/global.css";

export default async function RootLayout({ params, children }) {
  const { lang } = params;
  let dictionary = (await import(`locales/${lang}.json`)).default;
  return (
    <html>
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
  const languages = ["jp", "en"];
  return languages.map((e) => ({
    lang: e,
  }));
}
