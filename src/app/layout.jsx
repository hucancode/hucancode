export const dynamic = "force-static";
import React from "react";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";
import I18n from "locales/i18n";
import languages from "locales/supported-languages";
import "styles/global.css";

export default async function RootLayout({ params, children }) {
  return (
    <html>
      <body className="page-container">
        <I18n>
          <Navbar />
          <main>{children}</main>
          <FootNote />
        </I18n>
      </body>
    </html>
  );
}
