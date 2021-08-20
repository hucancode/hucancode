import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

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

const RedIcon = styled.span`
    ${tw`
        w-7
        h-7
        rounded-full
        bg-red-500
        flex
        items-center
        justify-center
        text-white
        text-base
        mr-2
    `}
`;

export default function ExperienceSection() {
    return <Container>
        <h1>Experience</h1>
    </Container>
}