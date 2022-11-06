"use client";
import React, { useState, useEffect, useRef } from "react";
import { ImMenu } from "react-icons/im";
import ThemeToggle from "widgets/theme-toggle";
import { useI18n } from "locales/i18n";
import Logo from "widgets/logo";
import Link from "next/link";
import SelectButton from "widgets/select-button";

function Container(props) {
  return (
    <nav className="px-10 max-w-screen-lg w-full h-16 flex flex-row items-center justify-between">
      {props.children}
    </nav>
  );
}

function LogoContainer(props) {
  return (
    <div
      className="w-12
        h-12
        bg-transparent
        select-none
        cursor-pointer"
    >
      {props.children}
    </div>
  );
}

function ThemeContainer(props) {
  return (
    <div
      className="flex items-center
        border-none
        outline-none
        cursor-pointer
        w-16 h-12
        bg-transparent
        select-none"
    >
      {props.children}
    </div>
  );
}

export default function Navbar() {
  const i18n = useI18n();
  console.log(`render nav bar, current language = ${i18n.locale()}`);

  return (
    <Container>
      <Link href="/">
        <LogoContainer>
          <Logo />
        </LogoContainer>
      </Link>
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
