import React, { useState } from "react";
import {
    SiAmazonaws, SiBlender,
    SiCircleci,
    SiCplusplus,
    SiCsharp,
    SiDocker,
    SiFirebase,
    SiFlutter,
    SiGraphql,
    SiJavascript,
    SiKotlin,
    SiNestjs,
    SiNextdotjs,
    SiOpengl,
    SiReact,
    SiSwift,
    SiThreedotjs,
    SiUnrealengine
} from 'react-icons/si';
import { RiGitlabFill } from 'react-icons/ri'
import { GrMysql } from "react-icons/gr";
import { DiNodejs } from "react-icons/di";
import { useTranslation } from 'next-i18next';
import SwitchButton from "../widgets/switch-button";

function Container(props) {
    return <section className="container 
    flex flex-col items-center
    bg-indigo-100 dark:bg-black
    py-10 md:px-10
    text-center
    overflow-hidden
    max-w-screen-lg" id={props.id}>
        {props.children}
    </section>
}

function SectionTitle(props) {
    return <h1 className="text-2xl mb-5 font-bold">
        {props.children}
    </h1>
}

function SkillSet(props) {
    return <ul className="skill-set"  active={props.active?'true':undefined}>
        {props.children}
    </ul>
}

function Skill(props) {
    return <li>
        <div>
            {props.icon}
        </div>
        <p>
            {props.name}
        </p>
    </li>
}

export default function SkillSection() {
    var [activeSet, setActiveSet] = useState(false);
    const { t } = useTranslation("home");

    return <Container id='skill'>
        <SectionTitle>{t('tools.title')}</SectionTitle>
        <SwitchButton
            inputId="switchSkill"
            labelA={t('tools.game')}
            labelB={t('tools.app')}
            onChange={(value) => setActiveSet(value)}>
        </SwitchButton>
        <SkillSet active={!activeSet}>
            <Skill name="C++" icon={<SiCplusplus size="2em" />} />
            <Skill name="C#" icon={<SiCsharp size="2em" />} />
            <Skill name="OpenGL" icon={<SiOpengl size="2em" />} />
            <Skill name="Blender" icon={<SiBlender size="2em" />} />
            <Skill name="Unreal" icon={<SiUnrealengine size="2em" />} />
            <Skill name="ThreeJS" icon={<SiThreedotjs size="2em" />} />
        </SkillSet>
        <SkillSet active={activeSet}>
            <Skill name="Kotlin" icon={<SiKotlin size="2em" />} />
            <Skill name="Swift" icon={<SiSwift size="2em" />} />
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
            <Skill name="Firebase" icon={<SiFirebase size="2em" />} />
            <Skill name="AWS" icon={<SiAmazonaws size="2em" />} />
            <Skill name="CircleCI" icon={<SiCircleci size="2em" />} />
            <Skill name="GitlabCI" icon={<RiGitlabFill size="2em" />} />
        </SkillSet>
    </Container>
}