module.exports = {
    ns: ['common','home','challenge'],
    defaultNS: "common",
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'jp'],
    },
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    react: {
        useSuspense: false,
        transSupportBasicHtmlNodes: true, // allow <br/> and simple html elements in translations
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'sup', 'em', 'code'], // don't convert to <1></1> if simple react elements
    }
};