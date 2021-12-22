import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import Link from 'next/link'
import { useTranslation } from 'next-i18next';
import { SiThreedotjs, SiUnrealengine, SiUnity, SiBlender, SiOpengl } from "react-icons/si";
import { GiPuppet } from 'react-icons/gi'

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        text-center
        p-10
        //bg-gray-200
        //dark:bg-black
    `}
`;

const SectionTitle = styled.h1`
    ${tw`
        text-2xl
        mb-5
        font-bold
    `}
`;

const ShowcaseContainer = styled.div`
    ${tw`
        w-full
        grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10
        text-center
        w-full
        max-w-screen-lg
    `}
`;

const ProjectCard = styled.div`
    ${tw`
        flex flex-col justify-center items-center
        text-center
        shadow-lg
        rounded-lg
        overflow-hidden
    `}
`;

// const UnderConstruction = styled(ConstructionIllustration)`
//     ${tw`
//         w-80
//         h-80
//     `}
// `;

const ProjectMedia = styled.div`
  ${tw`
    flex
    items-center
    w-full
    max-w-screen-md
    object-contain
  `}
  flex-grow: 1;
  background: radial-gradient(closest-side, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.2));
`;

const ProjectDetail = styled.div`
    ${tw`
        flex justify-between items-center gap-4
        text-left
        relative
        right-0
        w-full max-w-screen-md
        bg-indigo-100 dark:bg-gray-600
        text-gray-600 dark:text-gray-100
        object-contain
        px-4
        py-6
    `}
    h2 {
        ${tw`
            font-black
            dark:text-indigo-100
            text-black
            cursor-pointer
        `}
    }
    p {
        ${tw`
            text-sm
        `}
    }
    span {
        ${tw`
            flex
            gap-2
        `}
    }
`;


const YoutubeContainer = styled.div`
    ${tw`
        overflow-hidden
        relative
        h-0
        w-full
    `}
    padding-bottom: 56.25%;
    iframe {
        ${tw`
            absolute
            left-0
            top-0
            w-full
            h-full
        `}
    }
`;

function YoutubeVideo(props) {
    return <YoutubeContainer> <iframe
        width="853"
        height="480"
        src={`https://www.youtube.com/embed/${props.videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded youtube"
    /></YoutubeContainer>
}

export default function ChallengeSection() {
    const { t } = useTranslation("home");
    return <Container id='challenge'>
        <SectionTitle>{t('challenge.title')}</SectionTitle>
        <ShowcaseContainer>
            <ProjectCard>
                <ProjectMedia>
                    <video autoPlay muted loop src="/assets/video/dragon-600-20s.webm" />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="dragon" passHref><h2>{t("challenge.dragon")}</h2></Link>
                        <p>{t("challenge.dragon-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><SiOpengl size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <video autoPlay muted loop src='/assets/video/spider-600-20s.webm' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="spider" passHref><h2>{t("challenge.spider")}</h2></Link>
                        <p>{t("challenge.spider-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><SiOpengl size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <video autoPlay muted loop src='/assets/video/sabor-600-20s.webm' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="sabor" passHref><h2>{t("challenge.sabor")}</h2></Link>
                        <p>{t("challenge.sabor-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><GiPuppet size="1.5em"/></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <YoutubeVideo videoId='9RCqafaFMcY' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="weapon-master" passHref><h2>{t("challenge.weapon-master")}</h2></Link>
                        <p>{t("challenge.weapon-master-sub")}</p>
                    </div>
                    <span><SiUnrealengine size="1.5em" /><SiBlender size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <YoutubeVideo videoId='xvNHCHPUz8A' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="doll" passHref><h2>{t("challenge.doll")}</h2></Link>
                        <p>{t("challenge.doll-sub")}</p>
                    </div>
                    <span><SiUnity size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
        </ShowcaseContainer>
    </Container>
}