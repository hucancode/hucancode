"use client";
import React from "react";
import { SiThreedotjs, SiBlender, SiOpengl } from "react-icons/si";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";
import ForestScene from "scenes/miniForest";

export default function Forest() {
  const i18n = useI18n();
  return (
    <div className="flex w-full max-w-screen-sm flex-col items-center px-10">
      <ForestScene />
    </div>
  );
}
