import React from "react";
import styles from "./youtube.module.css";

export default function YoutubeVideo(props) {
  return (
    <div className={styles["youtube-frame"]}>
      {" "}
      <iframe
        width="853"
        height="480"
        src={`https://www.youtube.com/embed/${props.videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded youtube"
      />
    </div>
  );
}
