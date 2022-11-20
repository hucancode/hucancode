"use client";
import React, { useState } from "react";
import {
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaFileDownload,
  FaHackerrank,
  FaSpider,
} from "react-icons/fa";
import {
  SiGithub,
  SiLeetcode,
  SiSketchfab,
  SiMinutemailer,
  SiBuymeacoffee,
} from "react-icons/si";
import {
  GiCubes,
  GiSeaDragon,
} from "react-icons/gi";
import {
  RiSwordFill,
} from "react-icons/ri";
// import Link from "next/link";
// import SaborScene from "scenes/sabor";
import { useI18n } from "locales/i18n";
import { FcDownload } from "react-icons/fc";
import {Marquee, SkillSet} from "components/skill-section";
import dynamic from 'next/dynamic'
import styles from "./landing-section.module.css";

const RubikScene = dynamic(() => import('scenes/rubik'))
const DragonScene = dynamic(() => import('scenes/dragon'))
const SpiderScene = dynamic(() => import('scenes/spider'))
const SaborScene = dynamic(() => import('scenes/sabor'))

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


function WavingHand() {
  return <span className={styles["waving-hand"]} />;
}

function Description(props) {
  return <div className="text-center md:text-left mb-4">{props.children}</div>;
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
      className="flex flex-col-reverse md:flex-row-reverse justify-start
        w-full md:grow
        items-center
        aspect-square
        md:aspect-video"
    >
      {props.children}
    </div>
  );
}

function SocialContainer(props) {
  return (
    <div className="flex justify-center gap-2 md:justify-start text-sm mt-1">
      {props.children}
    </div>
  );
}

function RoundIcon(props) {
  return (
    <span
      className="flex h-12
        w-12
        items-center justify-center
        rounded-full
        bg-gray-700 text-base text-white
        duration-300
        hover:bg-black"
    >
      {props.children}
    </span>
  );
}

function HistoryNavigator(props) {
  return (
    <div
      className="flex md:flex-col justify-center
        w-full md:w-auto"
    >
      {props.children}
    </div>
  );
}

function HistoryButton(props) {
  return (
    <button
      className="p-4 aria-checked:bg-black aria-checked:text-white"
      onClick={props.onClick}
      aria-checked={props.active ? "true" : undefined}
    >
      {props.children}
    </button>
  );
}

export default function LandingSection() {
  const i18n = useI18n();
  let resumeUrl = i18n.locale() == "en" ? "/resume.pdf" : "/resume-jp.pdf";
  let [activeSet, setActiveSet] = useState(0);
  return (
    <Container>
      <About>
        <Greetings>
          <Hello>{i18n.t("home.landing.hello")}</Hello>
          <WavingHand />
        </Greetings>
        <Description>
          {i18n.t("home.landing.about1")}
        </Description>
        <SocialContainer>
          <a
            target="_blank"
            rel="noreferrer"
            href="https://github.com/hucancode"
          >
            <RoundIcon>
              <SiGithub size="1.5em" />
            </RoundIcon>
          </a>
          <a
            target="_blank"
            rel="noreferrer"
            title={i18n.t("common.contact.sendMail")}
            href="mailto:hucancode@gmail.com"
          >
            <RoundIcon>
              <SiMinutemailer size="1.5em" />
            </RoundIcon>
          </a>
          <a
            target="_blank"
            rel="noreferrer"
            title={i18n.t("common.contact.downloadResume")}
            href={resumeUrl}
          >
            <RoundIcon>
              <FaFileDownload size="1.5em" />
            </RoundIcon>
          </a>
        </SocialContainer>
        <Marquee>
          <SkillSet />
          <SkillSet />
        </Marquee>
      </About>
      <CanvasContainer>
      <HistoryNavigator>
          <HistoryButton
            onClick={() => setActiveSet(0)}
            active={activeSet === 0}
          >
              <GiCubes size="1.5em" />
          </HistoryButton>
          <HistoryButton
            onClick={() => setActiveSet(1)}
            active={activeSet === 1}
          >
              <GiSeaDragon size="1.5em" />
          </HistoryButton>
          <HistoryButton
            onClick={() => setActiveSet(2)}
            active={activeSet === 2}
          >
            <RiSwordFill size="1.5em" />
          </HistoryButton>
      </HistoryNavigator>
      {(() => { 
        console.log(`active set = ${activeSet}`)
        switch(activeSet){
          case 0: 
              return <RubikScene />
          case 1:
              return <DragonScene />
          case 2: 
            return <SaborScene />
          case 3:
            return <SpiderScene />
          default:
            return <RubikScene />
        }
      })()}
      </CanvasContainer>
    </Container>
  );
}
