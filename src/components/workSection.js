import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { ReactComponent as ConstructionIllustration } from "../assets/gummy-blackboard.svg";

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

const UnderConstruction = styled(ConstructionIllustration)`
    ${tw`
        w-60
        h-60
    `}
`;

export default function WorkSection() {
    return <Container>
        <SectionTitle>Something I've built</SectionTitle>
        <ProjectContainer>
            <UnderConstruction/>
        </ProjectContainer>
    </Container>
}