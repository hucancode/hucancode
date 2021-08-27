import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';

const Container = styled.div`
    ${tw`
        container
        box-border
        pb-5
        relative
        flex
        items-center
        justify-center
        max-w-screen-lg
        w-full
        overflow-x-hidden
        overflow-y-hidden
        text-xs
        text-center
    `}
`;


export default function FootNote() {
    return <Container>
        <p>
            Made with <code>React.js</code>, <code>Three.js</code> and 10+ other tools<br/>
            <small>Dragon model by <a href="https://sketchfab.com/3d-models/chinese-dragon-fa05f2a6596041938152a84a956212e0">youmeowmeow</a></small>
        </p>
        
    </Container>
}