"use client";
import React, { useState } from "react";
import {
  SiArchlinux,
  SiBlender,
  SiCplusplus,
  SiDocker,
  SiFastlane,
  SiFlutter,
  SiGithub,
  SiGraphql,
  SiNestjs,
  SiNextdotjs,
  SiOpengl,
  SiReact,
  SiReactivex,
  SiTailwindcss,
  SiUnrealengine,
  SiVim,
} from "react-icons/si";
import { RiGoogleFill } from "react-icons/ri";
import { GrMysql } from "react-icons/gr";
import { DiNodejs } from "react-icons/di";
import SlideButton from "widgets/slide-button";
import { useI18n } from "locales/i18n";

function Container(props) {
  return (
    <section
      className="flex w-full
    max-w-screen-lg flex-col items-center
    overflow-hidden py-4 px-6
    text-center"
      id={props.id}
    >
      {props.children}
    </section>
  );
}

function SkillSet(props) {
  return (
    <ul
      className="flex h-0 origin-top scale-y-0
            flex-wrap items-center justify-center overflow-hidden
            duration-300
            aria-expanded:h-auto
            aria-expanded:scale-y-100 aria-expanded:overflow-visible"
      aria-expanded={props["aria-expanded"]}
    >
      {props.children}
    </ul>
  );
}

function Skill(props) {
  return (
    <li
      className="m-3 flex
                h-16 w-12 flex-col
                items-center"
    >
      <div
        className="flex h-12
                    w-12 items-center justify-center
                    text-base
                    text-gray-700 dark:text-gray-400"
      >
        {props.icon}
      </div>
      <p className="w-24 text-center font-mono text-xs">{props.name}</p>
    </li>
  );
}

export default function SkillWidget() {
  return (
    <Container>
      <SkillSet aria-expanded={true}>
        <Skill name="Arch Linux" icon={<SiArchlinux size="2em" />} />
        <Skill name="Vim" icon={<SiVim size="2em" />} />
        <Skill name="C++" icon={<SiCplusplus size="2em" />} />
        <Skill name="OpenGL" icon={<SiOpengl size="2em" />} />
        <Skill name="Blender" icon={<SiBlender size="2em" />} />
        <Skill name="Unreal" icon={<SiUnrealengine size="2em" />} />
        <Skill name="RX" icon={<SiReactivex size="2em" />} />
        <Skill name="React" icon={<SiReact size="2em" />} />
        <Skill name="Tailwind" icon={<SiTailwindcss size="2em" />} />
        <Skill name="NextJS" icon={<SiNextdotjs size="2em" />} />
        <Skill name="NestJS" icon={<SiNestjs size="2em" />} />
        <Skill name="Flutter" icon={<SiFlutter size="2em" />} />
        <Skill name="MySQL" icon={<GrMysql size="2em" />} />
        <Skill name="GraphQL" icon={<SiGraphql size="2em" />} />
        <Skill name="Docker" icon={<SiDocker size="2em" />} />
        <Skill name="Fastlane" icon={<SiFastlane size="2em" />} />
        <Skill name="Google Cloud" icon={<RiGoogleFill size="2em" />} />
        <Skill name="Github" icon={<SiGithub size="2em" />} />
      </SkillSet>
    </Container>
  );
}
