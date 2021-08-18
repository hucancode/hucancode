import React from "react";
import styled from "styled-components";
import tw from "twin.macro";

const Container = styled.div`
    ${tw`
        border
        border-solid
        border-gray-500
        px-4
        py-2
    `}
`;

export default function Logo() {
    return <Container>
        <h1>LOGO</h1>
    </Container>
}