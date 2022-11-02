"use client";
import React from "react";
import { SiCsharp, SiUnity } from "react-icons/si";
import YoutubeVideo from "widgets/youtube";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";

function ProjectCard(props) {
  return <div className="challenge-card">{props.children}</div>;
}

function YoutubeFrame(props) {
  return <div className="media">{props.children}</div>;
}

function ProjectDetail(props) {
  return <div className="detail">{props.children}</div>;
}

export default function ProceduralDragon() {
  const i18n = useI18n();
  return (
    <ProjectCard>
      <YoutubeFrame>
        <YoutubeVideo videoId="xvNHCHPUz8A" />
      </YoutubeFrame>
      <ProjectDetail>
        <h2>{i18n.t("doll.title")}</h2>
        <span>
          <SiUnity size="1.5em" />
          <SiCsharp size="1.5em" />
        </span>
        <p>
          Small top down shooter game made with Unity, featuring a laser gun and
          alot of fearsome &quot;monster&quot;.
        </p>
      </ProjectDetail>
    </ProjectCard>
  );
}
