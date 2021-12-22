import React from 'react';
import { appWithTranslation } from 'next-i18next';
import '../styles/index.css';
import Head from 'next/head'

function App({ Component, pageProps }) {
    return <>
        <Head>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        <Component {...pageProps} />
    </>
}

export default appWithTranslation(App);