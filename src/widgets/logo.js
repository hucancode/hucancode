import React from "react";
import styled from "styled-components";
import tw from "twin.macro";

const Container = styled.div`
    ${tw`
        px-20
        py-2
        overflow-hidden
    `}
`;
const LogoText = styled.h1`
    ${tw`
        font-black
        relative
        hover:text-red-700
        z-10
        after:absolute
        after:block
        after:w-full
        after:h-full
        after:left-1/2
        after:bottom-0
        after:transform
        after:-translate-x-1/2
        after:-skew-x-80
        after:scale-x-150
        after:duration-200
        after:ease-in
        after:bg-blue-300
        after:opacity-0
        after:-z-10
        hover:after:w-3/2
        hover:after:-skew-x-20
        hover:after:scale-x-100
        hover:after:opacity-100
    `}
    &:after {
        content: "";
    }
    font-family: "Megrim", -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
    "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
`;

export default function Logo() {
    return <Container>
        <LogoText>HU</LogoText>
    </Container>
}