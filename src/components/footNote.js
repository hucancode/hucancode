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
        bg-gray-200
        dark:bg-black
    `}
`;


export default function FootNote() {
    return <Container>
        <p>
            Site is under constructions. <br />Made with <code>React.js</code> and <code>Three.js</code>
        </p>
    </Container>
}