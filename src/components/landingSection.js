import React from "react";
import styled, { keyframes } from 'styled-components';
import tw from 'twin.macro';
import { init, animate } from "../scenes/sabor";

const Container = styled.section`
    ${tw`
        container
        box-border
        relative
        flex
        flex-col
        md:flex-row
        max-w-screen-lg
        w-full
        items-center
        justify-around
        overflow-x-hidden
        overflow-y-hidden
        mt-10
        mb-10
    `}
`;

const About = styled.div`
  ${tw`
    md:relative
    md:left-0
    md:w-1/2
    w-full
    pb-10
  `}
`;

const Title = styled.h1`
  ${tw`
    text-4xl
    mb-3
    select-none
  `}
`;


const WAVE_STRENGTH = 20.0;
const WaveAnimation = keyframes`
    0% { transform: rotate( 0.0deg) }
    10% { transform: rotate(${WAVE_STRENGTH}deg) }  /* The following five values can be played with to make the waving more or less extreme */
    20% { transform: rotate(-${WAVE_STRENGTH * 0.5}deg) }
    30% { transform: rotate(${WAVE_STRENGTH * 0.5}.0deg) }
    40% { transform: rotate(-${WAVE_STRENGTH * 0.5}.0deg) }
    50% { transform: rotate( 0.0deg) }  /* Reset for the last half to pause */
`;

const WavingHand = styled.span`
  &:hover {
    animation: ${WaveAnimation} 2.5s infinite;
    transform-origin: 70% 70%;
    display: inline-block;
  }
`;

const Description = styled.p`
  ${tw`
    text-lg
  `}
`;

const CanvasContainer = styled.div`
  ${tw`
    flex
    items-center
    relative
    right-0
    md:w-2/3
    lg:w-1/2
    xl:w-2/5
    w-full
    object-contain
  `}
`;

const Canvas = styled.canvas`
    ${tw`
      w-full
    `}
`;

class SaborScene extends React.Component {
    componentDidMount() {
        init();
        animate();
    }
    render() {
        return <CanvasContainer>
            <Canvas id='renderer' />
        </CanvasContainer>
    }
}

export default function LandingSection() {
    return <Container>
        <About>
            <Title>Hello! <WavingHand>👋</WavingHand></Title>
            <Description>
                I'm Bang, a passionate Front End Software Engineer.<br />
                I build mobile applications and games for a living.
            </Description>
        </About>
        <SaborScene />
    </Container>
}