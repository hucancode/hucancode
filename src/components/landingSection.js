import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { init, animate } from "../scenes/sabor";

const Container = styled.div`
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
    `}
`;

const About = styled.div`
  ${tw`
    md:relative
    md:left-0
    md:w-1/2
    w-full
    pt-10
    pb-10
  `}
`;

const Title = styled.h1`
  ${tw`
    text-4xl
    mb-3
  `}
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
      <Title>Hello! 👋</Title>
      <Description>
        I'm Bang. I'm a passionate Front End Software Engineer.<br/>
        I build mobile applications and games for a living.
      </Description>
    </About>
    <SaborScene />
  </Container>
}