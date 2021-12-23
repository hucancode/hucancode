import React from "react";

function Container(props) {
    return <div className="youtube-frame" >
        {props.children}
    </div>
}

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