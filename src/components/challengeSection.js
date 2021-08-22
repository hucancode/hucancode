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
        w-80
        h-80
    `}
`;

export default function ChallengeSection() {
    return <Container id='works'>
        <SectionTitle>Some coding challenge I've done</SectionTitle>
        <ProjectContainer>
            <UnderConstruction/>
        </ProjectContainer>
    </Container>
}