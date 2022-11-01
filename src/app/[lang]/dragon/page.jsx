"use client";
import React from "react";
import DragonScene from "scenes/dragon";
import { RiRefreshFill } from "react-icons/ri";
import { useI18n } from "locales/i18n";

function ProjectCard(props) {
  return <div className="challenge-card">{props.children}</div>;
}

function ProjectMedia(props) {
  return (
    <div className="media-3d w-full flex flex-col items-center">
      {props.children}
    </div>
  );
}

function ActionButton(props) {
  return (
    <button
      className="rounded-md bg-sky-300 dark:bg-gray-600 flex gap-2 items-center px-4 py-2 active:outline outline-2 outline-sky-700 cursor-pointer"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export default function ProceduralDragon() {
  const dragon = React.useRef(null);
  const i18n = useI18n();
  return (
    <ProjectCard>
      <ProjectMedia>
        <DragonScene ref={dragon} />
        <ActionButton onClick={() => dragon.current.newFlyingPath()}>
          <RiRefreshFill size="2.5em" />
          {i18n.t("challenge.dragon.refresh")}
        </ActionButton>
      </ProjectMedia>
    </ProjectCard>
  );
}
