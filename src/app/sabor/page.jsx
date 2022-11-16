"use client";
import React from "react";
import SaborScene from "scenes/sabor";
import { useI18n } from "locales/i18n";
import "styles/challenge-card.css";

export default function Sabor() {
  const i18n = useI18n();
  return (
    <div className="flex w-full max-w-screen-sm flex-col items-center px-10">
      <SaborScene />
    </div>
  );
}
