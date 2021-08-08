import React, { Component } from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { init, animate } from "../scenes/sabor";

const Container = styled.div`
    min-height: 300px;
    ${tw`
        flex
        flex-col
        w-full
        h-full
        items-center
        overflow-x-hidden
    `}
`;

const Canvas = styled.canvas`
    ${tw`
        min-w-full
        min-h-full
    `}
`;

class SaborSceneComponent extends Component {
    componentDidMount() {
      init();
      animate();
    }
    render() {
      return (
        <Container>
            <Canvas id='renderer'></Canvas>
        </Container>
      )
    }
  }
  
  export default function SaborScene() {
    return <SaborSceneComponent />
  }