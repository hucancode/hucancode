"use client";
import { useI18n } from "locales/i18n";
import React from "react";

export default function SectionTitle(props) {
  const i18n = useI18n();
  return (
    <h1 className="mb-5 text-2xl font-bold uppercase">{i18n.t(props.text)}</h1>
  );
}
