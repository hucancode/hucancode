"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import { GiCubes, GiSeaDragon } from "react-icons/gi";
import { RiSwordFill } from "react-icons/ri";

const RubikScene = dynamic(() => import("scenes/rubik"));
const DragonScene = dynamic(() => import("scenes/dragon"));
const SaborScene = dynamic(() => import("scenes/sabor"));
//const SpiderScene = dynamic(() => import('scenes/spider'))

function CanvasContainer(props) {
  return (
    <div
      className="flex aspect-square w-full flex-col-reverse
        items-center justify-start
        md:aspect-video
        md:grow
        md:flex-row-reverse"
    >
      {props.children}
    </div>
  );
}

function HistoryNavigator(props) {
  return (
    <div
      className="flex w-full justify-center
        md:w-auto md:flex-col"
    >
      {props.children}
    </div>
  );
}

function HistoryButton(props) {
  return (
    <button
      className="p-4 aria-checked:bg-black aria-checked:text-white"
      onClick={props.onClick}
      aria-checked={props.active ? "true" : undefined}
    >
      {props.children}
    </button>
  );
}

export default function MiniShowcase() {
  let [activeSet, setActiveSet] = useState(0);
  return (
    <CanvasContainer>
      <HistoryNavigator>
        <HistoryButton onClick={() => setActiveSet(0)} active={activeSet === 0}>
          <GiCubes size="1.5em" />
        </HistoryButton>
        <HistoryButton onClick={() => setActiveSet(1)} active={activeSet === 1}>
          <GiSeaDragon size="1.5em" />
        </HistoryButton>
        <HistoryButton onClick={() => setActiveSet(2)} active={activeSet === 2}>
          <RiSwordFill size="1.5em" />
        </HistoryButton>
      </HistoryNavigator>
      {(() => {
        switch (activeSet) {
          case 0:
            return <RubikScene />;
          case 1:
            return <DragonScene />;
          case 2:
            return <SaborScene />;
          //   case 3:
          //     return <SpiderScene />
          default:
            return <RubikScene />;
        }
      })()}
    </CanvasContainer>
  );
}
