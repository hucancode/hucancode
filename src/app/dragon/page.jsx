"use client";
import React from "react";
import DragonScene from "scenes/dragon";
import { RiRefreshFill } from "react-icons/ri";
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

export default function ProceduralDragon() {
  const dragon = React.useRef(null);
  const i18n = useI18n();
  return (
    <div className="container flex max-w-screen-lg flex-col items-center">
      <DragonScene ref={dragon} />
      <ActionButton onClick={() => dragon.current.newFlyingPath()}>
        <RiRefreshFill size="2.5em" />
        {i18n.t("challenge.dragon.refresh")}
      </ActionButton>
    </div>
  );
}
