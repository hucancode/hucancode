import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import DragonScene from "../scenes/dragon";
import SpiderScene from "../scenes/spider";
import { useTranslation, Trans } from 'next-i18next';

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
        flex
        justify-center
        flex-wrap
        text-center
        w-full
        max-w-screen-lg
    `}
`;


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
        w-full
        overflow-hidden
        mb-10
    `}
`;

// const UnderConstruction = styled(ConstructionIllustration)`
//     ${tw`
//         w-80
//         h-80
//     `}
// `;

const CanvasContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    relative
    right-0
    w-full
    md:w-2/3
    max-w-screen-md
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
    const { t } = useTranslation();
    return <Container id='challenge'>
        <SectionTitle>{t('challenge.title')}</SectionTitle>
        <ShowcaseContainer>
            <ProjectContainer>
                <CanvasContainer>
                    <DragonScene/>
                </CanvasContainer>
                
                <DetailContainer> <Trans i18nKey="challenge.dragon">
                    <h2>Procedural Dragon</h2>
                    <small>🛠 ThreeJS, Vertex Shader</small>
                    <p>Dragon animations are procedurally generated with following steps:</p>
                    <ul>
                        <li>Load static dragon mesh. Posed in a straight line</li>
                        <li>Build a curve using THREE.CatmullRomCurve3</li>
                        <li>Pass curve data down to GPU via a texture</li>
                        <li>Inside vertex shader, read texture data and set vertex position accordingly</li>
                    </ul>
                </Trans> </DetailContainer>
            </ProjectContainer>
            <ProjectContainer>
                <CanvasContainer>
                    <SpiderScene/>
                </CanvasContainer>
                <DetailContainer> <Trans i18nKey="challenge.spider">
                    <h2>Procedural Spider</h2>
                    <small>🛠 ThreeJS, Inverse Kinematics</small>
                    <p>Spider animations are procedurally generated using Inverse Kinematics</p>
                </Trans> </DetailContainer>
            </ProjectContainer>
            <ProjectContainer>
                <CanvasContainer>
                    <YoutubeVideo videoId='9RCqafaFMcY'/>
                </CanvasContainer>
                <DetailContainer> <Trans i18nKey="challenge.wm">
                    <h2>Weapon Master</h2>
                    <small>🛠 Unreal Engine, Gameplay Abilities System</small>
                    <p>This is small RPG made with Unreal Engine, featuring 10+ switchable weapons.</p>
                    <ul>
                        <li>Each weapon has unique skill set. Weapon has it's own animation logic and completely independent from character logic.</li>
                        <li>Full locomotion animation. Dashing, Jumping, Sprinting, Flying.</li>
                        <li>Some skill has interaction with locomotion state, try swing a sword while in air or quickly hit while dashing.</li>
                        <li>Featuring hit react system. Player get stunned when hit. High impact skill knocks down enemy dramatically using ragdoll physics.</li>
                    </ul>
                </Trans> </DetailContainer>
            </ProjectContainer>
            <ProjectContainer>
                <CanvasContainer>
                    <YoutubeVideo videoId='xvNHCHPUz8A'/>
                </CanvasContainer>
                <DetailContainer> <Trans i18nKey="challenge.doll">
                    <h2>Gun and Doll</h2>
                    <small>🛠 Unity3D</small>
                    <p>Small top down shooter game made with Unity, featuring a laser gun and alot of fearsome "monster".</p>
                </Trans> </DetailContainer>
            </ProjectContainer>
        </ShowcaseContainer>
    </Container>
}