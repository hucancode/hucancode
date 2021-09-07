
import styled, { keyframes } from "styled-components";
import tw from 'twin.macro';

const LoadingAnimation = keyframes`
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
`;
const Icon = styled.div`
    ${tw`
        inline-block
        relative
        w-40
        h-40
    `}
    & div {
        ${tw`
            box-border
            block
            absolute
            w-32
            h-32
            m-4
        `}
        border: 1.5rem solid #fff;
        border-radius: 50%;
        animation: ${LoadingAnimation} 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        border-color: #fff transparent transparent transparent;
    }
    & div:nth-child(1) {
        animation-delay: -0.45s;
    }
    & div:nth-child(2) {
        animation-delay: -0.3s;
    }
    & div:nth-child(3) {
        animation-delay: -0.15s;
    }
`;
export function LoadingIcon() {
    return <Icon>
        <div/><div/><div/><div/>
    </Icon>
}