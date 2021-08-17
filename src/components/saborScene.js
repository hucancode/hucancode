import React, { Component } from "react";
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
        min-w-full
        h-screen
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
    w-full
    object-contain
  `}
`;

const Canvas = styled.canvas`
    ${tw`
      w-full
    `}
`;

class SaborSceneComponent extends Component {
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

export default function SaborScene() {
  return <Container>
    <About>
      <p>
        Site is under constructions. <br />Made with <code>React.js</code> and <code>Three.js</code>
      </p>
    </About>
    <SaborSceneComponent />
  </Container>
}