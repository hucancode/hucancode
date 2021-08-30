import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import DragonScene from "../scenes/dragon";

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        text-center
        p-10
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
    `}
`;


const ProjectContainer = styled.div`
    ${tw`
        flex
        justify-center
        items-center
        flex-wrap
        text-center
        md:w-1/3
        lg:w-1/2
        xl:w-3/5
        w-full
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
    // md:w-2/3
    // lg:w-1/2
    // xl:w-2/5
    w-full
    max-w-screen-md
    object-contain
  `}
  background: radial-gradient(closest-side, rgba(83, 91, 99, 0.3), rgba(17, 24, 39, 0));
`;

export default function ChallengeSection() {
    return <Container id='works'>
        <SectionTitle>Something interesting I have challenged</SectionTitle>
        <h1>Under Construction</h1>
        <ShowcaseContainer>
            <CanvasContainer>
                <DragonScene/>
                <small>Dragon animations are procedurally generated using shader</small>
            </CanvasContainer>
            <ProjectContainer>
            </ProjectContainer>
        </ShowcaseContainer>
    </Container>
}