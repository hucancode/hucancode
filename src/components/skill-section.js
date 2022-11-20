"use client";
import React, { useState } from "react";
import {
  SiAmazonaws,
  SiBlender,
  SiCircleci,
  SiCplusplus,
  SiCsharp,
  SiDocker,
  SiFlutter,
  SiGraphql,
  SiJavascript,
  SiKotlin,
  SiNestjs,
  SiNextdotjs,
  SiOpengl,
  SiReact,
  SiSwift,
  SiUnrealengine,
  SiReactivex,
  SiFastlane,
  SiGithub,
  SiArchlinux,
  SiThreedotjs,
} from "react-icons/si";
import { RiGoogleFill } from "react-icons/ri";
import { GrMysql } from "react-icons/gr";
import { DiNodejs } from "react-icons/di";
import SlideButton from "widgets/slide-button";
import { useI18n } from "locales/i18n";
import styles from "./skill-section.module.css";

function Container(props) {
  return (
    <section
      className="flex w-full
    max-w-screen-lg flex-col items-center
    overflow-hidden py-10 px-4
    text-center
    md:px-10"
      id={props.id}
    >
      <div className="mb-6 h-1 w-full max-w-sm bg-gray-900/10 dark:bg-white/10" />

      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return <h1 className="mb-5 text-2xl font-bold">{props.children}</h1>;
}

export function SkillSet(props) {
  return (
    <ul
      className="flex min-w-max items-center justify-center overflow-hidden animate-marquee"
    >
        <Skill name="Blender" icon={<SiBlender size="2em" />} />
        <Skill name="C++" icon={<SiCplusplus size="2em" />} />
        <Skill name="OpenGL" icon={<SiOpengl size="2em" />} />
        <Skill name="Unreal" icon={<SiUnrealengine size="2em" />} />
        <Skill name="RX" icon={<SiReactivex size="2em" />} />
        <Skill name="ThreeJs" icon={<SiThreedotjs size="2em" />} />
        <Skill name="React" icon={<SiReact size="2em" />} />
        <Skill name="NextJS" icon={<SiNextdotjs size="2em" />} />
        <Skill name="Flutter" icon={<SiFlutter size="2em" />} />
        <Skill name="MySQL" icon={<GrMysql size="2em" />} />
        <Skill name="GraphQL" icon={<SiGraphql size="2em" />} />
        <Skill name="Docker" icon={<SiDocker size="2em" />} />
        <Skill name="NestJS" icon={<SiNestjs size="2em" />} />
    </ul>
  );
}

export function Marquee(props) {
  return (
    <div className={`${styles.marquee} w-full flex items-center justify-start relative overflow-hidden`}>
      {props.children}
    </div>
  );
}
function Skill(props) {
  return (
    <li
      className="m-3 flex
                h-16 w-12 flex-col
                text-gray-500 dark:text-gray-500
                items-center"
    >
      <div
        className="flex h-12
                    w-12 items-center justify-center
                    text-base"
      >
        {props.icon}
      </div>
      <p className="w-24 text-center font-mono text-xs">{props.name}</p>
    </li>
  );
}

export default function SkillSection() {
  return (
    <Container id="skill">
    <Marquee>
      <SkillSet />
    </Marquee>
    </Container>
  );
}
