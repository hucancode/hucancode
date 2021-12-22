import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { useTranslation, Trans } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head'
import { SiCsharp, SiUnity } from "react-icons/si";
import Navbar from "../components/navigation-bar";
import YoutubeVideo from "../widgets/youtube";
import FootNote from "../components/foot-note";

const Container = styled.div`
    ${tw`
        flex flex-col justify-start items-center gap-4
        w-screen md:h-full min-h-screen
        bg-indigo-200 dark:bg-gray-900
        text-gray-800 dark:text-white
    `}
`;
const Main = styled.main`
    ${tw`
        flex justify-center items-stretch
        w-full 
        py-2
        px-5
    `}
    flex-grow: 1;
`;
const ProjectCard = styled.div`
    ${tw`
        flex flex-col md:flex-row justify-start items-center
        text-center
        shadow-lg
        rounded-lg
        w-full max-w-screen-md
        overflow-hidden
        mb-20
    `}
    flex-grow: 1;
`;

const YoutubeFrame = styled.div`
  ${tw`
    flex items-center justify-center
    relative
    right-0
    w-full md:w-2/3 h-full
    object-contain
  `}
  background: radial-gradient(closest-side, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.2));
`;

const ProjectDetail = styled.div`
    ${tw`
        flex flex-col justify-start items-start gap-4
        text-left
        relative
        right-0
        w-full md:w-1/3 md:h-full 
        bg-indigo-100 dark:bg-gray-600
        text-gray-600 dark:text-gray-100
        object-contain
        p-4
    `}
    h2 {
        ${tw`
            font-black
            dark:text-indigo-100 text-black
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
            text-gray-500 dark:text-gray-300
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
    span {
        ${tw`
            flex gap-2
        `}
    }
`;

export default function ProceduralDragon() {
    const { t } = useTranslation('challenge');
    return <Container>
        <Head>
            <title>{t("doll.title")}</title>
        </Head>
        <Navbar />
        <Main>
            <ProjectCard>
                <Head>
                    <title>{t("doll.title")}</title>
                </Head>
                <YoutubeFrame>
                    <YoutubeVideo videoId='xvNHCHPUz8A' />
                </YoutubeFrame>
                <ProjectDetail>
                    <h2>{t("doll.title")}</h2>
                    <span><SiUnity size="1.5em" /><SiCsharp size="1.5em" /></span>
                    <Trans i18nKey="challenge:doll.description">
                        <p>Small top down shooter game made with Unity, featuring a laser gun and alot of fearsome &quot;monster&quot;.</p>
                    </Trans>
                </ProjectDetail>
            </ProjectCard>
        </Main>
        <FootNote />
    </Container>
}

export async function getStaticProps({ locale }) {
    return {
        props: {
            ...(await serverSideTranslations(locale, ['common', 'challenge'])),
            // Will be passed to the page component as props
        },
    };
}
