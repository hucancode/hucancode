import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';

const Container = styled.div`
    ${tw`
        overflow-hidden
        relative
        h-0
        w-full
    `}
    padding-bottom: 56.25%;
    iframe {
        ${tw`
            absolute
            left-0
            top-0
            w-full
            h-full
        `}
    }
`;

export default function YoutubeVideo(props) {
    return <Container> <iframe
        width="853"
        height="480"
        src={`https://www.youtube.com/embed/${props.videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded youtube"
    /></Container>
}