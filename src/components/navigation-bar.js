"use client";
import React, { useState, useEffect, useRef } from "react";
import { ImMenu } from "react-icons/im";
import ThemeToggle from "widgets/theme-toggle";
import useI18n from "locales/use-i18n";
import Logo from "widgets/logo";
import Link from "next/link";

function Container(props) {
  return <nav>{props.children}</nav>;
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

export default function Navbar() {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isMdOrUp, setIsMdOrUp] = useState(false);
  const drawerRef = useRef(null);

  const i18n = useI18n();
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

  const navItems = (
    <ul ref={drawerRef} open={isDrawerOpen || isMdOrUp}>
      <li>
        <Link href="/#skill">{i18n.t("common.nav.skill")}</Link>
      </li>
      <li>
        <Link href="/#experiences">{i18n.t("common.nav.exp")}</Link>
      </li>
      <li>
        <Link href="/#challenge">{i18n.t("common.nav.works")}</Link>
      </li>
      <li>
        <Link href="/#contact">{i18n.t("common.nav.contact")}</Link>
      </li>
    </ul>
  );

  return (
    <Container>
      <HamburgerContainer onClick={() => setDrawerOpen(true)}>
        <ImMenu size="2.5em" />
      </HamburgerContainer>
      <Link href="/">
        <LogoContainer>
          <Logo />
        </LogoContainer>
      </Link>
      {navItems}
      <ThemeContainer>
        <ThemeToggle />
      </ThemeContainer>
    </Container>
  );
}
