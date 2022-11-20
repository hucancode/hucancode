"use client";
import React, { useState, useEffect, useRef } from "react";
import ThemeToggle from "widgets/theme-toggle";
import { useI18n } from "locales/i18n";
import Logo from "widgets/logo";
import Link from "next/link";
import SelectButton from "widgets/select-button";

function Container(props) {
  return (
    <nav className="flex h-16 w-full max-w-screen-lg flex-row items-center justify-between px-4 md:px-10">
      {props.children}
    </nav>
  );
}

function LogoContainer(props) {
  return (
    <div
      className="h-12
        w-12
        cursor-pointer
        select-none
        bg-transparent"
    >
      {props.children}
    </div>
  );
}

function ThemeContainer(props) {
  return (
    <div
      className="flex h-12
        w-16
        cursor-pointer
        select-none
        items-center border-none
        bg-transparent
        outline-none"
    >
      {props.children}
    </div>
  );
}

export default function Navbar() {
  const i18n = useI18n();
  return (
    <Container>
      <SelectButton
        inputId="switchLanguage"
        labelA="🇺🇸"
        labelB="🇯🇵"
        onChange={(value) => {
          if (value) {
            i18n.locale("jp");
          } else {
            i18n.locale("en");
          }
        }}
      ></SelectButton>
      <ThemeContainer>
        <ThemeToggle />
      </ThemeContainer>
    </Container>
  );
}
