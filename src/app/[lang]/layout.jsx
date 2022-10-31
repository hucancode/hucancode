'use client';
import React, { useEffect } from 'react';
import { contentLanguageMap } from 'locales/i18n'
import 'styles/global.css';
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";
import I18n from 'locales/i18n'
import EN from 'locales/en.json';

export default function RootLayout({ children }) {
  return (
    <html>
      <body className="page-container">
        <I18n lngDict={EN} locale='en'>
          <Navbar/>
          <main>
            {children}
          </main>
          <FootNote/>
        </I18n>
      </body>
    </html>
  );
}

export async function generateStaticParams() {
  const languages = ['en','jp'];
  return languages.map((e) => ({
    lang: e
  }));
}
