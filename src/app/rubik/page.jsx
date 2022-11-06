"use client";
import React from "react";
import { SiThreedotjs, SiBlender, SiOpengl } from "react-icons/si";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";
import RubikScene from "scenes/rubik";

export default function Rubik() {
  const i18n = useI18n();
  return (
    <div className="w-full max-w-screen-sm px-10 flex flex-col items-center">
      <RubikScene />
    </div>
  );
}