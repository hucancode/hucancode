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
} from "react-icons/si";
import { RiGoogleFill } from "react-icons/ri";
import { GrMysql } from "react-icons/gr";
import { DiNodejs } from "react-icons/di";
import SlideButton from "widgets/slide-button";
import { useI18n } from "locales/i18n";

function Container(props) {
  return (
    <section
      className="container 
    max-w-screen-lg
    flex flex-col items-center
    py-10 md:px-10
    text-center
    overflow-hidden"
      id={props.id}
    >
    <div className="h-1 w-full max-w-sm mb-6 dark:bg-white/10 bg-gray-900/10" />

      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return <h1 className="text-2xl mb-5 font-bold">{props.children}</h1>;
}

function SkillSet(props) {
  return (
    <ul
      className="flex flex-wrap items-center justify-center
            h-0 scale-y-0 aria-expanded:h-auto aria-expanded:scale-y-100
            duration-300
            origin-top
            overflow-hidden"
      aria-expanded={props["aria-expanded"]}
    >
      {props.children}
    </ul>
  );
}

function Skill(props) {
  return (
    <li className="w-12 h-16
                flex flex-col items-center
                m-3">
      <div className="w-12 h-12
                    flex items-center justify-center
                    text-base
                    text-gray-700 dark:text-gray-400">{props.icon}</div>
      <p className="text-xs font-mono text-center">{props.name}</p>
    </li>
  );
}

export default function SkillSection() {
  var [activeSet, setActiveSet] = useState(false);
  const i18n = useI18n();
  return (
    <Container id="skill">
      <SectionTitle>{i18n.t("home.tools.title")}</SectionTitle>
      <SlideButton
        inputId="switchSkill"
        labelA={i18n.t("home.tools.game")}
        labelB={i18n.t("home.tools.app")}
        onChange={(value) => setActiveSet(value)}
      ></SlideButton>
      <SkillSet aria-expanded={!activeSet}>
        <Skill name="C++" icon={<SiCplusplus size="2em" />} />
        <Skill name="C#" icon={<SiCsharp size="2em" />} />
        <Skill name="OpenGL" icon={<SiOpengl size="2em" />} />
        <Skill name="Blender" icon={<SiBlender size="2em" />} />
        <Skill name="Unreal" icon={<SiUnrealengine size="2em" />} />
      </SkillSet>
      <SkillSet aria-expanded={activeSet}>
        <Skill name="Javascript" icon={<SiJavascript size="2em" />} />
        <Skill name="React" icon={<SiReact size="2em" />} />
        <Skill name="NextJS" icon={<SiNextdotjs size="2em" />} />
        <Skill name="NestJS" icon={<SiNestjs size="2em" />} />
        <Skill name="Flutter" icon={<SiFlutter size="2em" />} />
        <Skill name="MySQL" icon={<GrMysql size="2em" />} />
        <Skill name="GraphQL" icon={<SiGraphql size="2em" />} />
        <Skill name="NodeJS" icon={<DiNodejs size="3em" />} />
        <Skill name="Docker" icon={<SiDocker size="2em" />} />
        <Skill name="GoogleCloud" icon={<RiGoogleFill size="2em" />} />
        <Skill name="CircleCI" icon={<SiCircleci size="2em" />} />
      </SkillSet>
    </Container>
  );
}
