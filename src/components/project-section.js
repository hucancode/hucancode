import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import SpiderScene from "../scenes/spider";

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        text-center
        p-10
        bg-gray-200
        dark:bg-black
    `}
`;

const SectionTitle = styled.h1`
    ${tw`
        text-2xl
        mb-5
        font-bold
    `}
`;

const ProjectContainer = styled.div`
    ${tw`
        w-full
        flex
        justify-center
        flex-wrap
        text-center
    `}
`;

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

export default function ProjectSection() {
    return <Container id='works'>
        <SectionTitle>Something I&apos;ve built</SectionTitle>
        Under Construction
        <ProjectContainer>
            <CanvasContainer>
                <SpiderScene/>
                <small>Spider animations are procedurally generated using Inverse Kinematics</small>
            </CanvasContainer>
        </ProjectContainer>
    </Container>
}