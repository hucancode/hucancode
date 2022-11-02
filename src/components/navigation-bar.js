"use client";
import React, { useState, useEffect, useRef } from "react";
import { ImMenu } from "react-icons/im";
import ThemeToggle from "widgets/theme-toggle";
import { useI18n } from "locales/i18n";
import Logo from "widgets/logo";
import Link from "next/link";

function Container(props) {
  return <nav className="container max-w-screen-lg w-full h-16 flex flex-row items-center justify-between">{props.children}</nav>;
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

function HamburgerContainer(props) {
  return (
    <button
      className="relative
        block
        md:hidden
        border-none
        outline-none
        cursor-pointer
        w-8 h-12
        mr-8
        select-none"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function NavItems(props) {
  return <ul className="flex flex-col md:flex-row
                z-40
                list-none
                fixed md:static 
                left-0
                top-0
                ease-out
                duration-200
                px-8
                py-6
                transform
                w-3/4 md:w-auto
                h-screen md:h-full
                dark:md:h-full
                bg-gray-100
                dark:bg-black
                md:bg-transparent
                dark:md:bg-transparent
                translate-x-0
                aria-hidden:-translate-x-full">
    {props.children}
    </ul>
}

function NavItem(props) {
  return <li className="text-3xl md:text-xl
                    dark:text-gray-300
                    text-gray-900
                    font-medium
                    mb-3
                    md:mr-5
                    cursor-pointer
                    transition
                    duration-300
                    ease-in-out
                    hover:text-gray-500
                    dark:hover:text-gray-100">
    {props.children}
  </li>
}

export default function Navbar() {
  const i18n = useI18n();
  console.log(`render nav bar, current language = ${i18n.locale()}`);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isMdOrUp, setIsMdOrUp] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    setIsMdOrUp(window.matchMedia("(min-width: 768px)").matches);
    const closeDrawer = (event) => {
      if (drawerRef.current && drawerRef.current.contains(event.target)) {
        return;
      }
      if (isDrawerOpen) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", closeDrawer);
    return () => document.removeEventListener("mousedown", closeDrawer);
  }, [isDrawerOpen]);

  return (
    <Container>
    {/*<HamburgerContainer onClick={() => setDrawerOpen(true)}>
        <ImMenu size="2.5em" />
      </HamburgerContainer>
      */}
      <a href="/">
        <LogoContainer>
          <Logo />
        </LogoContainer>
      </a>
    {/*
      <NavItems ref={drawerRef} aria-hidden={!(isDrawerOpen || isMdOrUp)}>
        <NavItem>
          <a href="#skill">{i18n.t("common.nav.skill")}</a>
        </NavItem>
        <NavItem>
          <a href="#experiences">{i18n.t("common.nav.exp")}</a>
        </NavItem>
        <NavItem>
          <a href="#challenge">{i18n.t("common.nav.works")}</a>
        </NavItem>
        <NavItem>
          <a href="#contact">{i18n.t("common.nav.contact")}</a>
        </NavItem>
      </NavItems>
      */}
      <ThemeContainer>
        <ThemeToggle />
      </ThemeContainer>
    </Container>
  );
}
