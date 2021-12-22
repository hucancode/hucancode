import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { Trans, useTranslation } from 'next-i18next';

const Container = styled.div`
    ${tw`
        container
        box-border
        pb-5
        relative
        flex
        items-center
        justify-center
        max-w-screen-lg
        w-full
        overflow-x-hidden
        overflow-y-hidden
        text-xs
        text-center
    `}
`;


export default function FootNote() {
    useTranslation();
    return <Container>
        <p>
            <Trans i18nKey="note.madeWith">
                Deployed with <code>Vercel</code> and <code>Github</code><br/>Made with <code>Next.js, Three.js, TailwindCSS, Styled-Components</code> and hundreds of other tools<br />
            </Trans>
        </p>
    </Container>
}