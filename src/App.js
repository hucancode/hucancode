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

const AppContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    w-full
    min-h-full
    bg-gray-300
    text-black
    dark:bg-gray-900
    dark:text-white
  `}
`;

export default function App() {
    return (
        
        <AppContainer>
            <Navbar />
            <Suspense fallback="loading">
                <LandingSection />
            </Suspense>
            <SkillSection />
            <ExperienceSection />
            {/* <ProjectSection /> */}
            <ChallengeSection />
            <FooterSection />
            <FootNote />
        </AppContainer>
        
    )
}