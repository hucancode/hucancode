"use client";
import React from "react";
import SpiderScene from "scenes/spider";
import { MdPlusOne } from "react-icons/md";
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

export default function ProceduralSpider() {
  const i18n = useI18n();
  const spider = React.useRef(null);
  return (
    <ProjectCard>
      <ProjectMedia>
        <SpiderScene ref={spider} />
        <ActionButton onClick={() => spider.current.generateSpider()}>
          <MdPlusOne size="2.5em" />
          {i18n.t("challenge.spider.addMore")}
        </ActionButton>
      </ProjectMedia>
    </ProjectCard>
  );
}