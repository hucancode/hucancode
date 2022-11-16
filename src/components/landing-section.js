"use client";
import React from "react";
// import Link from "next/link";
// import SaborScene from "scenes/sabor";
import { useI18n } from "locales/i18n";
import { FcDownload } from "react-icons/fc";
import styles from "./landing-section.module.css";
//import DragonScene from "scenes/dragon";
import RubikScene from "scenes/rubik";

function Container(props) {
  return (
    <section
      className="relative
        my-10 flex
        w-full max-w-screen-lg flex-col items-center justify-around
        overflow-hidden
        px-10
        md:flex-row"
      id={props.id}
    >
      {props.children}
    </section>
  );
}

function About(props) {
  return (
    <div
      className="flex
    w-full flex-col items-center
    pb-10 md:relative
    md:left-0 md:w-1/3
    md:items-start"
    >
      {props.children}
    </div>
  );
}

function Greetings(props) {
  const className = `select-none text-4xl font-bold mb-4`;
  return <h1 className={className}>{props.children}</h1>;
}

function Hello(props) {
  const className =
    "text-fill-none bg-clip-text bg-double-width bg-rainbow2 animate-bg-pingpong";
  return <span className={className}>{props.children}</span>;
}

function Subtitle(props) {
  return (
    <h2
      className="after:content-['Tap
        here
        to
        change
        language']
        after:animate-language-guide after:select-none after:text-sm after:font-thin after:text-black
        after:dark:text-white"
    >
      {props.children}
    </h2>
  );
}

function WavingHand() {
  return <span className={styles["waving-hand"]} />;
}

function Description(props) {
  return <div className="text-center md:text-left">{props.children}</div>;
}

function ResumeDownloadContainer(props) {
  const className = `${styles["resume-download-container"]} group`;
  return <button className={className}>{props.children}</button>;
}

function ResumeDownloadIcon() {
  return (
    <div className="mr-3 group-hover:animate-bounce group-hover:[animation-delay:-0.5s]">
      <FcDownload size="2em" />
    </div>
  );
}

function ResumeLink(props) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      href={props.href}
      className="flex h-full w-full
            cursor-pointer items-center
            justify-center
            bg-gray-800 p-5
            text-sm
            uppercase text-white
            dark:bg-black dark:text-white"
    >
      {props.children}
    </a>
  );
}

function CanvasContainer(props) {
  return (
    <div
      className="relative right-0 flex
        w-full
        items-center
        justify-center object-contain
        md:w-2/3"
    >
      {props.children}
    </div>
  );
}

export default function LandingSection() {
  const i18n = useI18n();
  return (
    <Container>
      <About>
        <Greetings>
          <Hello>{i18n.t("home.landing.hello")}</Hello>
          <WavingHand />
        </Greetings>
        <Description>
          {i18n.t("home.landing.about1")}
          <br />
          {/*i18n.t("home.landing.about2")*/}
        </Description>
      </About>
      <CanvasContainer>
        <RubikScene />
      </CanvasContainer>
    </Container>
  );
}
