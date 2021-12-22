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
                Made with <code>React.js</code>, <code>Three.js</code> and 10+ other tools<br />
            </Trans>
            <Trans i18nKey="note.assetCredit">
                <small>Dragon model by <a href="https://sketchfab.com/3d-models/chinese-dragon-fa05f2a6596041938152a84a956212e0">youmeowmeow</a></small>.
                <small>Spider model by <a href="https://sketchfab.com/3d-models/low-poly-spider-walk-cycle-e4d2c40b66554b10be20f61bb0610774">volkanongun</a></small>
            </Trans>
        </p>
    </Container>
}