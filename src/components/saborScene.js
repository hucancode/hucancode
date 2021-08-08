import React, { Component } from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import * as THREE from "three";

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

class SceneComponent extends Component {
    componentDidMount() {
      let canvas = document.getElementById('renderer');
      let w = window.innerWidth*0.8;
      let h = window.innerHeight*0.8;
      var renderer = new THREE.WebGLRenderer({canvas: canvas});
      renderer.setSize( w, h );
      
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera( 75, w/h, 0.1, 1000 );
      var geometry = new THREE.BoxGeometry( 1, 1, 1 );
      var material = new THREE.MeshBasicMaterial( { color: 0x61dafb } );
      var cube = new THREE.Mesh( geometry, material );
      scene.add( cube );
      camera.position.z = 5;
      var animate = function () {
        requestAnimationFrame( animate );
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render( scene, camera );
      };
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
    return <SceneComponent />
  }