"use client";
import React from "react";
import SaborScene from "scenes/sabor";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";

export default function Sabor() {
  const i18n = useI18n();
  return (
    <div className="flex w-full md:aspect-video aspect-square max-w-screen-lg flex-col items-center px-4 md:px-10">
      <SaborScene />
    </div>
  );
}
