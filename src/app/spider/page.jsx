"use client";
import React from "react";
import SpiderScene from "scenes/spider";
import { MdPlusOne } from "react-icons/md";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";

function ActionButton(props) {
  return (
    <button
      className="flex cursor-pointer items-center gap-2 rounded-md bg-sky-300 px-4 py-2 outline-2 outline-sky-700 active:outline dark:bg-gray-600"
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
    <div className="flex aspect-square w-full max-w-screen-lg flex-col items-center md:aspect-video">
      <SpiderScene ref={spider} />
      <ActionButton onClick={() => spider.current.generateSpider()}>
        <MdPlusOne size="2.5em" />
        {i18n.t("challenge.spider.addMore")}
      </ActionButton>
    </div>
  );
}
