import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';

const Container = styled.div`
    ${tw`
        container
        flex
        flex-col
        md:flex-row
        bg-gray-200
        dark:bg-black
        p-10
    `}
`;

export default function SkillSection() {
    return <Container>
        <h1>Skill</h1>
    </Container>
}