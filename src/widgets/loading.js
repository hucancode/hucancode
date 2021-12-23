// import styled, { keyframes } from "styled-components";
// import tw from 'twin.macro';

// const LoadingAnimation = keyframes`
//     0% {
//         transform: rotate(0deg);
//     }
//     100% {
//         transform: rotate(360deg);
//     }
// `;
// const Icon = styled.div`
//     ${tw`
//         inline-block
//         relative
//         w-40
//         h-40
//     `}
//     & div {
//         ${tw`
//             box-border
//             block
//             absolute
//             w-32
//             h-32
//             m-4
//             border-solid
//             rounded-[50%]
//             border-[1.5rem]
//             border-t-white border-r-transparent border-b-transparent border-l-transparent
//         `}
//         animation: ${LoadingAnimation} 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
//     }
//     & div:nth-child(1) {
//         animation-delay: -0.45s;
//     }
//     & div:nth-child(2) {
//         animation-delay: -0.3s;
//     }
//     & div:nth-child(3) {
//         animation-delay: -0.15s;
//     }
// `;
// export default function LoadingIcon() {
//     return <Icon>
//         <div /><div /><div /><div />
//     </Icon>
// }

// const LoadingContainer = styled.div`
//     ${tw`
//         flex
//         items-center
//         justify-center
//         w-screen
//         h-screen
//         overflow-hidden
//     `}
// `;

// export function Loading() {
//     return <LoadingContainer>
//         <LoadingIcon />
//     </LoadingContainer>
// }