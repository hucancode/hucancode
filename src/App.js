import React, { Suspense } from "react";
import styled from "styled-components";
import tw from 'twin.macro';
import './i18n';
import './App.css';
import Navbar from "./components/navBar";
import LandingSection from "./components/landingSection";
import SkillSection from "./components/skillSection";
import ExperienceSection from "./components/experienceSection";
// import ProjectSection from "./components/projectSection";
import ChallengeSection from "./components/challengeSection";
import FootNote from "./components/footNote";
import FooterSection from "./components/footerSection";
import {LoadingIcon} from "./widgets/loading"

const AppContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    w-full
    min-h-full
    bg-indigo-200
    text-gray-600
    dark:bg-gray-900
    dark:text-white
  `}
`;

const LoadingContainer = styled.div`
    ${tw`
        flex
        items-center
        justify-center
        w-screen
        h-screen
        overflow-hidden
    `}
`;

function Loading() {
    return <LoadingContainer>
        <LoadingIcon />
    </LoadingContainer>
}

export default function App() {
    return (
        <AppContainer>
            <Suspense fallback={<Loading />}>
                <Navbar />
                <LandingSection />
                <SkillSection />
                <ExperienceSection />
                {/* <ProjectSection /> */}
                <ChallengeSection />
                <FooterSection />
                <FootNote />
            </Suspense>
        </AppContainer>
    )
}