import React from 'react';
import { appWithTranslation } from 'next-i18next';
import '../styles/index.css';

function App({ Component, pageProps }) {
    return <Component {...pageProps} />
}


export default appWithTranslation(App);