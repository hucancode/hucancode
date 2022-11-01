"use client";
import React from "react";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";
import I18n from "locales/i18n";
import "styles/global.css";

export default function RootLayout({ children }) {
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

export async function generateStaticParams() {
  const languages = ["en", "jp"];
  return languages.map((e) => ({
    lang: e,
  }));
}
