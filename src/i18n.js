import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
// don't want to use this?
// have a look at the Quick start guide 
// for passing in lng and translations on init

i18n
  // load translation using http -> see /public/locales (i.e. https://github.com/i18next/react-i18next/tree/master/example/react/public/locales)
  // learn more: https://github.com/i18next/i18next-http-backend
  // want your translations to be loaded from a professional CDN? => https://github.com/locize/react-tutorial#step-2---use-the-locize-cdn
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: 'en',
    debug: true,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    react: {
        // ...
        hashTransKey: function(defaultValue) {
          // return a key based on defaultValue or if you prefer to just remind you should set a key return false and throw an error
        },
        transEmptyNodeValue: '', // what to return for empty Trans
        transSupportBasicHtmlNodes: true, // allow <br/> and simple html elements in translations
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'sup', 'em', 'code'], // don't convert to <1></1> if simple react elements
        transWrapTextNodes: '', // Wrap text nodes in a user-specified element.
                                // i.e. set it to 'span'. By default, text nodes are not wrapped.
                                // Can be used to work around a well-known Google Translate issue with React apps. See: https://github.com/facebook/react/issues/11538
                                // (v11.10.0)
      }
  });


export default i18n;