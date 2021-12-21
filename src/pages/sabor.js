import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import SaborScene from "../../scenes/sabor";
import { useTranslation, Trans } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

const ProjectContainer = styled.div`
    ${tw`
        flex
        justify-center
        items-center
        flex-col
        md:flex-row
        text-center
        shadow-lg
        rounded-lg
        w-screen
        h-screen
        overflow-hidden
    `}
`;

const CanvasContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    justify-center
    relative
    right-0
    w-full
    h-full
    object-contain
  `}
  background: radial-gradient(closest-side, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.2));
`;

const DetailContainer = styled.div`
    ${tw`
        flex
        flex-col
        justify-start
        items-start
        text-left
        relative
        right-0
        md:w-1/3
        md:h-full
        w-full
        bg-indigo-100
        text-gray-600
        dark:bg-gray-600
        dark:text-gray-100
        max-w-screen-md
        object-contain
        p-4
        pb-5
    `}
    h2 {
        ${tw`
            font-black
            dark:text-indigo-100
            text-black
        `}
    }
    p, ul {
        ${tw`
            font-normal
            text-sm
        `}
    }
    small {
        ${tw`
            font-thin
            text-gray-500
            dark:text-gray-300
            mb-3
        `}
    }
    & ul li {
        ${tw`
            relative
            pl-5
            before:content-["▸"]
            before:absolute
            before:left-0
        `}
    }
`;

export default function Sabor() {
    const { t } = useTranslation();
    return <ProjectContainer>
                <CanvasContainer>
                    <SaborScene/>
                </CanvasContainer>
                
                <DetailContainer> <Trans i18nKey="challenge.sabor">
                    <h2>Sabor</h2>
                    <small>🛠 ThreeJS, Blender</small>
                    <p>This is a game-ready character. Rigged and animated using Blender</p>
                </Trans> </DetailContainer>
            </ProjectContainer>
}

export async function getStaticProps({ locale }) {
    return {
      props: {
        ...(await serverSideTranslations(locale, ['translation'])),
        // Will be passed to the page component as props
      },
    };
  }
