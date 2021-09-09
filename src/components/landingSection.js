import React from "react";
import styled, { keyframes } from 'styled-components';
import tw from 'twin.macro';
import SaborScene from "../scenes/sabor";
import { useTranslation, Trans } from 'react-i18next';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileDownload } from "@fortawesome/free-solid-svg-icons";

const Container = styled.section`
    ${tw`
        container
        box-border
        relative
        flex
        flex-col
        md:flex-row
        max-w-screen-lg
        w-full
        items-center
        justify-around
        overflow-x-hidden
        overflow-y-hidden
        mt-10
        mb-10
    `}
`;

const About = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    md:items-start
    md:relative
    md:left-0
    md:w-1/2
    w-full
    pb-10
  `}
`;

const Greetings = styled.div`
    ${tw`
        flex
        flex-col
        items-center
        md:items-start
        mb-10
        cursor-pointer
        overflow-hidden
        max-w-max
    `}
`;
const LanguageGuideAnimation = keyframes`
    0% {
        content: "Tap here to change language";
    }
    30% {
        opacity: 1;
    }
    50% {
        opacity: 0;
    }
    70% {
        opacity: 1;
    }
    100% {
        content: "言語変更には、ここにタップ";
    }
`;

const Title = styled.h1`
  ${tw`
    text-4xl
    font-bold
    select-none
  `}
`;

const Subtitle = styled.h2`
    &:after {
        ${tw`
            text-sm
            font-thin
            select-none
            dark:text-white
            text-black
        `}
        animation: ${LanguageGuideAnimation} 5s linear alternate infinite;
        content: "Tap here to change language";
    }
`;

const WAVE_STRENGTH = 20.0;
const WaveAnimation = keyframes`
    0% { transform: rotate( 0.0deg) }
    10% { transform: rotate(${WAVE_STRENGTH}deg) }  /* The following five values can be played with to make the waving more or less extreme */
    20% { transform: rotate(-${WAVE_STRENGTH * 0.5}deg) }
    30% { transform: rotate(${WAVE_STRENGTH * 0.5}.0deg) }
    40% { transform: rotate(-${WAVE_STRENGTH * 0.5}.0deg) }
    50% { transform: rotate( 0.0deg) }  /* Reset for the last half to pause */
`;

const WavingHand = styled.span`
  &:hover {
    animation: ${WaveAnimation} 2.5s infinite;
    transform-origin: 70% 70%;
    display: inline-block;
  }
`;

const Description = styled.p`
  ${tw`
    text-lg
  `}
`;

const ResumeDownload = styled.a`
    ${tw`
        flex
        items-center
        justify-center
        text-sm
        uppercase
        bg-gray-600
        text-white
        hover:text-blue-200
        cursor-pointer
        mt-10
        p-3
        w-full
    `}
    span {
        ${tw`
            ml-3
        `}
    }
`;

const CanvasContainer = styled.div`
    ${tw`
        flex
        items-center
        relative
        right-0
        md:w-2/3
        lg:w-1/2
        xl:w-2/5
        w-full
        object-contain
    `}
`;

export default function LandingSection() {
    const { t, i18n } = useTranslation();
    return <Container>
        <About>
            <Greetings onClick={() => i18n.changeLanguage(i18n.language==='en'?'jp':'en')}>
                <Title>{t('landing.hello')} <WavingHand>👋</WavingHand></Title>
                <Subtitle/>
            </Greetings>
            <Description>
                <Trans i18nKey="landing.about">
                    I am Bang, a passionate Front End Software Engineer. <br/>
                    I build mobile applications and games for a living.
                </Trans>
                <ResumeDownload target="_blank" rel="noreferrer" href="https://docs.google.com/document/d/13RuquH_8FjIR39k3a7dr5uJn5Ml93opzPl73DiKLRHs/edit?usp=sharing">
                    <FontAwesomeIcon icon={faFileDownload} size="lg"/>
                    <span>{t('contact.downloadResume')}</span>
                </ResumeDownload>
            </Description>
        </About>
        <CanvasContainer>
            <SaborScene />
        </CanvasContainer>
    </Container>
}