"use client";
import React from "react";
import { useI18n } from "locales/i18n";

function Container(props) {
  return (
    <div
      className="container
        relative
        flex
        w-full max-w-screen-lg items-center
        justify-center overflow-hidden
        pb-5
        text-center
        text-xs
        text-gray-500"
    >
      {props.children}
    </div>
  );
}

export default function FootNote() {
  const i18n = useI18n();
  return (
    <Container>
      <p>{i18n.t("common.note.madeWith")}</p>
    </Container>
  );
}
