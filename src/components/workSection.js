import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';

const Container = styled.div`
    ${tw`
        container
        flex
        flex-col
        md:flex-row
        p-10
    `}
`;


export default function WorkSection() {
    return <Container>
        <h1>Works</h1>
    </Container>
}