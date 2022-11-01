"use client";
import React from "react";
import { SiBlender, SiCplusplus, SiUnrealengine } from "react-icons/si";
import YoutubeVideo from "widgets/youtube";
import { useI18n } from "locales/i18n";

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
        <YoutubeVideo videoId="9RCqafaFMcY" />
      </YoutubeFrame>
      <ProjectDetail>
        <h2>{i18n.t("challenge.weapon-master.title")}</h2>
        <span>
          <SiUnrealengine size="1.5em" />
          <SiBlender size="1.5em" />
          <SiCplusplus size="1.5em" />
        </span>
        <p>
          This is small RPG made with Unreal Engine, featuring 10+ switchable
          weapons.
        </p>
        <ul>
          <li>
            Each weapon has unique skill set. Weapon has it&apos;s own animation
            logic and completely independent from character logic.
          </li>
          <li>
            Full locomotion animation. Dashing, Jumping, Sprinting, Flying.
          </li>
          <li>
            Some skill has interaction with locomotion state, try swing a sword
            while in air or quickly hit while dashing.
          </li>
          <li>
            Featuring hit react system. Player get stunned when hit. High impact
            skill knocks down enemy dramatically using ragdoll physics.
          </li>
        </ul>
      </ProjectDetail>
    </ProjectCard>
  );
}
