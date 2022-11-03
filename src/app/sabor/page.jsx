"use client";
import React from "react";
import SaborScene from "scenes/sabor";
import { SiThreedotjs, SiBlender, SiOpengl } from "react-icons/si";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";

function ProjectCard(props) {
  return <div className="challenge-card">{props.children}</div>;
}

function ProjectMedia(props) {
  return <div className="media-3d">{props.children}</div>;
}

function ProjectDetail(props) {
  return <div className="detail">{props.children}</div>;
}

export default function Sabor() {
  const i18n = useI18n();
  return (
    <div className="w-full max-w-screen-sm px-10 flex flex-col items-center">
      <SaborScene />
    </div>
  );
}
