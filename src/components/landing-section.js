"use client";
import React from "react";
import Link from "next/link";
import SaborScene from "scenes/sabor";
import { useI18n } from "locales/i18n";
import { FcDownload } from "react-icons/fc";
import styles from "./landing-section.module.css";
import DragonScene from "scenes/dragon";

function Container(props) {
  return (
    <section
      className="container
        relative
        max-w-screen-lg w-full
        flex flex-col md:flex-row items-center justify-around
        overflow-hidden
        my-10"
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
    flex-col items-center md:items-start
    md:relative md:left-0
    md:w-1/2 w-full
    pb-10"
    >
      {props.children}
    </div>
  );
}

function Greetings(props) {
  return (
    <div
      className="flex flex-col items-center md:items-start
        mb-10
        max-w-max"
    >
      {props.children}
    </div>
  );
}

function Title(props) {
  return <h1 className="text-4xl font-bold select-none">{props.children}</h1>;
}

function Subtitle(props) {
  return (
    <h2
      className="after:text-sm
        after:font-thin
        after:select-none
        after:dark:text-white
        after:text-black
        after:content-['Tap here to change language']
        after:animate-language-guide"
    >
      {props.children}
    </h2>
  );
}

function WavingHand() {
  return <span className={styles["waving-hand"]} />;
}

function Description(props) {
  return (
    <div className="text-lg text-center md:text-left">{props.children}</div>
  );
}

function ResumeDownloadContainer(props) {
  const className = `${styles["resume-download-container"]} group`;
  return <button className={className}>{props.children}</button>;
}

function ResumeDownloadIcon() {
  return (
    <div className="group-hover:[animation-delay:-0.5s] group-hover:animate-bounce mr-3">
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
      className="flex items-center justify-center
            text-sm uppercase
            cursor-pointer
            w-full h-full
            p-5
            bg-gray-800 dark:bg-black
            text-white dark:text-white"
    >
      {props.children}
    </a>
  );
}

function CanvasContainer(props) {
  return (
    <div
      className="flex items-center justify-center
        relative
        right-0
        md:w-2/3 lg:w-1/2 xl:w-2/5 w-full
        object-contain"
    >
      {props.children}
    </div>
  );
}

export default function LandingSection() {
  const i18n = useI18n();
  console.log("render Landing Section");
  let resumeUrl =
    i18n.locale() == "en"
      ? "https://resume.hucanco.de"
      : "https://resume.hucanco.de/jp";
  return (
    <Container>
      <About>
		<Greetings>
			<Title>
				{i18n.t("home.landing.hello")} <WavingHand />
			</Title>
		</Greetings>
        <Description>
          {i18n.t("home.landing.about")}
        </Description>
      </About>
      <CanvasContainer>
        <DragonScene />
      </CanvasContainer>
    </Container>
  );
}
