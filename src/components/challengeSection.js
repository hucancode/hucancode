import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { init, animate } from "../scenes/dragon";
//import { ReactComponent as ConstructionIllustration } from "../assets/gummy-blackboard.svg";

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
`;

const Canvas = styled.canvas`
    ${tw`
      w-full
    `}
`;

class DragonScene extends React.Component {
    componentDidMount() {
        init();
        animate();
    }
    render() {
        return <CanvasContainer>
            <Canvas id='dragon' />
        </CanvasContainer>
    }
}

export default function ChallengeSection() {
    return <Container id='works'>
        <SectionTitle>Some coding challenge I've done</SectionTitle>
        <h1>Under Construction</h1>
        <ShowcaseContainer>
            <DragonScene/>
            <ProjectContainer>
            </ProjectContainer>
        </ShowcaseContainer>
    </Container>
}