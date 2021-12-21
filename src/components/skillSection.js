import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDocker, faJs, faNode, faReact } from "@fortawesome/free-brands-svg-icons";
import { useTranslation } from 'next-i18next';
import {
    CPPViewBox, CPPSVGPath,
    CSViewBox, CSSVGPath,
    OpenGLViewBox, OpenGLSVGPath,
    BlenderViewBox, BlenderSVGPath,
    UnrealViewBox, UnrealSVGPath,
    ThreeViewBox, ThreeSVGPath,
    NestViewBox, NestSVGPath,
    FlutterViewBox, FlutterSVGPath,
    MySQLViewBox, MySQLSVGPath,
    GraphQLViewBox, GraphQLSVGPath,
    FirebaseViewBox, FirebaseSVGPath, 
    CircleViewBox, CircleSVGPath, 
    AWSViewBox, AWSSVGPath, 
    GitlabViewBox, GitlabSVGPath, 
    KtViewBox, KtSVGPath, 
    SwiftViewBox, SwiftSVGPath
} from '../assets/svgData';
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
            <FontAwesomeIcon icon={props.icon} size="2x"></FontAwesomeIcon>
        </SkillIconContainer>
        <SkillName>
            {props.name}
        </SkillName>
    </SkillContainer>
}

function SkillHollowSVG(props) {
    return <SkillContainer>
        <SkillIconContainer>
            <SVGIconHollow viewBox={props.viewBox} fill="none" strokeWidth="5">
            {props.paths.map((path,i) =><path key={i} d={path} />)}
            </SVGIconHollow>
        </SkillIconContainer>
        <SkillName>
            {props.name}
        </SkillName>
    </SkillContainer>
}

function SkillSVG(props) {
    return <SkillContainer>
        <SkillIconContainer>
            <SVGIcon viewBox={props.viewBox}>
                {props.paths.map((path,i) =><path key={i} d={path} />)}
            </SVGIcon>
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
            <SkillSVG name="C++" viewBox={CPPViewBox} paths={CPPSVGPath}/>
            <SkillSVG name="C#" viewBox={CSViewBox} paths={CSSVGPath}/>
            <SkillSVG name="OpenGL" viewBox={OpenGLViewBox} paths={OpenGLSVGPath}/>
            <SkillSVG name="Blender" viewBox={BlenderViewBox} paths={BlenderSVGPath}/>
            <SkillSVG name="Unreal Engine" viewBox={UnrealViewBox} paths={UnrealSVGPath}/>
            <SkillHollowSVG name="ThreeJS" viewBox={ThreeViewBox} paths={ThreeSVGPath}/>
        </SkillSet>
        <SkillSet active={activeSet}>
            <SkillSVG name="Kotlin" viewBox={KtViewBox} paths={KtSVGPath} />
            <SkillSVG name="Swift" viewBox={SwiftViewBox} paths={SwiftSVGPath} />
            <Skill name="Javascript" icon={faJs}/>
            <Skill name="React" icon={faReact}/>
            <SkillSVG name="Nest" viewBox={NestViewBox} paths={NestSVGPath} />
            <SkillSVG name="Flutter" viewBox={FlutterViewBox} paths={FlutterSVGPath} />
            <SkillSVG name="MySQL" viewBox={MySQLViewBox} paths={MySQLSVGPath} />
            <SkillSVG name="GraphQL" viewBox={GraphQLViewBox} paths={GraphQLSVGPath} />
            <Skill name="NodeJS" icon={faNode}/>
        </SkillSet>
        <SkillSet active>
            <Skill name="Docker" icon={faDocker}/>
            <SkillSVG name="Firebase" viewBox={FirebaseViewBox} paths={FirebaseSVGPath} />
            <SkillSVG name="AWS" viewBox={AWSViewBox} paths={AWSSVGPath} />
            <SkillSVG name="Circle CI" viewBox={CircleViewBox} paths={CircleSVGPath} />
            <SkillSVG name="Gitlab CI" viewBox={GitlabViewBox} paths={GitlabSVGPath} />
        </SkillSet>
    </Container>
}