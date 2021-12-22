import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';
import { SiAmazonaws, SiBlender, 
    SiCircleci, 
    SiCplusplus, 
    SiCsharp, 
    SiDocker, 
    SiFirebase, 
    SiFlutter, 
    SiGitlab, 
    SiGraphql, 
    SiJavascript, 
    SiKotlin, 
    SiNestjs, 
    SiOpengl, 
    SiReact, 
    SiSwift, 
    SiThreedotjs, 
    SiUnrealengine } from 'react-icons/si';
import { GrMysql } from "react-icons/gr";
import { DiNodejs } from "react-icons/di";
import { useTranslation } from 'next-i18next';
import SwitchButton from "../widgets/switchButton";

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        bg-indigo-100
        dark:bg-black
        pt-10
        pb-10
        md:p-10
        text-center
        overflow-hidden
        max-w-screen-lg
    `}
`;
const SectionTitle = styled.h1`
    ${tw`
        text-2xl
        mb-5
        font-bold
    `}
`;

const SkillSet = styled.ul`
    ${tw`
        flex
        flex-wrap
        items-center
        justify-center
        duration-300
        origin-top
        overflow-hidden
    `}
    ${props => props.active ? `height: auto;transform: scaleY(1);` : `height: 0; display:hidden;transform: scaleY(0.0);`}
`;

const SkillContainer = styled.li`
    ${tw`
        w-12
        h-16
        flex
        flex-col
        items-center
        m-3
    `}
`;

const SkillIconContainer = styled.div`
    ${tw`
        w-12
        h-12
        flex
        items-center
        justify-center
        text-base
        text-gray-700
        dark:text-gray-400
    `}
`;

const SVGIcon = styled.svg`
    ${tw`
        w-full
        fill-current
        text-gray-700
        dark:text-gray-400
    `}
`;

const SVGIconHollow = styled.svg`
    ${tw`
        w-full
        stroke-current
        text-gray-700
        dark:text-gray-400
    `}
`;


const SkillName = styled.p`
    ${tw`
        text-xs
        font-mono
        text-center
    `}
`;

function Skill(props) {
    return <SkillContainer>
        <SkillIconContainer>
            {props.icon}
        </SkillIconContainer>
        <SkillName>
            {props.name}
        </SkillName>
    </SkillContainer>
}

export default function SkillSection() {
    var [activeSet, setActiveSet] = useState(false);
    const { t } = useTranslation();
    
    return <Container id='skill'>
        <SectionTitle>{t('tools.title')}</SectionTitle>
        <SwitchButton 
            inputId="switchSkill"
            labelA={t('tools.game')}
            labelB={t('tools.app')}
            onChange={(value) => setActiveSet(value)}>
        </SwitchButton>
        <SkillSet active={!activeSet}>
            <Skill name="C++" icon={<SiCplusplus size="2em" />}/>
            <Skill name="C#" icon={<SiCsharp size="2em" />}/>
            <Skill name="OpenGL" icon={<SiOpengl size="2em" />}/>
            <Skill name="Blender" icon={<SiBlender size="2em" />}/>
            <Skill name="Unreal" icon={<SiUnrealengine size="2em" />}/>
            <Skill name="ThreeJS" icon={<SiThreedotjs size="2em" />}/>
        </SkillSet>
        <SkillSet active={activeSet}>
            <Skill name="Kotlin" icon={<SiKotlin size="2em" />}/>
            <Skill name="Swift" icon={<SiSwift size="2em" />}/>
            <Skill name="Javascript" icon={<SiJavascript size="2em" />}/>
            <Skill name="React" icon={<SiReact size="2em" />}/>
            <Skill name="Nest" icon={<SiNestjs size="2em" />}/>
            <Skill name="Flutter" icon={<SiFlutter size="2em" />}/>
            <Skill name="MySQL" icon={<GrMysql size="2em" />}/>
            <Skill name="GraphQL" icon={<SiGraphql size="2em" />}/>
            <Skill name="NodeJS" icon={<DiNodejs size="3em" />}/>
        </SkillSet>
        <SkillSet active>
            <Skill name="Docker" icon={<SiDocker size="2em" />}/>
            <Skill name="Firebase" icon={<SiFirebase size="2em" />}/>
            <Skill name="AWS" icon={<SiAmazonaws size="2em" />}/>
            <Skill name="CircleCI" icon={<SiCircleci size="2em" />}/>
            <Skill name="GitlabCI" icon={<SiGitlab size="2em" />}/>
        </SkillSet>
    </Container>
}