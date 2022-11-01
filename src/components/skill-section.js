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
import SwitchButton from "widgets/switch-button";
import { useI18n } from "locales/i18n";

function Container(props) {
  return (
    <section
      className="container 
    flex flex-col items-center
    bg-indigo-100 dark:bg-black
    py-10 md:px-10
    text-center
    overflow-hidden"
      id={props.id}
    >
      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return <h1 className="text-2xl mb-5 font-bold">{props.children}</h1>;
}

function SkillSet(props) {
  return (
    <ul className="skill-set" active={props.active ? "true" : undefined}>
      {props.children}
    </ul>
  );
}

function Skill(props) {
  return (
    <li>
      <div>{props.icon}</div>
      <p>{props.name}</p>
    </li>
  );
}

export default function SkillSection() {
  var [activeSet, setActiveSet] = useState(false);
  const i18n = useI18n();
  return (
    <Container id="skill">
      <SectionTitle>{i18n.t("home.tools.title")}</SectionTitle>
      <SwitchButton
        inputId="switchSkill"
        labelA={i18n.t("home.tools.game")}
        labelB={i18n.t("home.tools.app")}
        onChange={(value) => setActiveSet(value)}
      ></SwitchButton>
      <SkillSet active={!activeSet}>
        <Skill name="C++" icon={<SiCplusplus size="2em" />} />
        <Skill name="C#" icon={<SiCsharp size="2em" />} />
        <Skill name="OpenGL" icon={<SiOpengl size="2em" />} />
        <Skill name="Blender" icon={<SiBlender size="2em" />} />
        <Skill name="Unreal" icon={<SiUnrealengine size="2em" />} />
      </SkillSet>
      <SkillSet active={activeSet}>
        <Skill name="Javascript" icon={<SiJavascript size="2em" />} />
        <Skill name="React" icon={<SiReact size="2em" />} />
        <Skill name="NextJS" icon={<SiNextdotjs size="2em" />} />
        <Skill name="NestJS" icon={<SiNestjs size="2em" />} />
        <Skill name="Flutter" icon={<SiFlutter size="2em" />} />
        <Skill name="MySQL" icon={<GrMysql size="2em" />} />
        <Skill name="GraphQL" icon={<SiGraphql size="2em" />} />
        <Skill name="NodeJS" icon={<DiNodejs size="3em" />} />
      </SkillSet>
      <SkillSet active>
        <Skill name="Docker" icon={<SiDocker size="2em" />} />
        <Skill name="GoogleCloud" icon={<RiGoogleFill size="2em" />} />
        <Skill name="CircleCI" icon={<SiCircleci size="2em" />} />
      </SkillSet>
    </Container>
  );
}
