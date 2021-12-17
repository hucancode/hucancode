import React, { Suspense } from "react";
import styled from "styled-components";
import tw from 'twin.macro';
import './i18n';
import './App.css';
import Loading from "./widgets/loading";
import Navbar from "./components/navBar";
// import LandingSection from "./components/landingSection";
// import SkillSection from "./components/skillSection";
// import LanguageSection from "./components/languageSection";
// import ExperienceSection from "./components/experienceSection";
// // import ProjectSection from "./components/projectSection";
// import ChallengeSection from "./components/challengeSection";
// import FootNote from "./components/footNote";
// import FooterSection from "./components/footerSection";

const LandingSection = React.lazy(() => import('./components/landingSection'));
const SkillSection = React.lazy(() => import('./components/skillSection'));
const LanguageSection = React.lazy(() => import('./components/languageSection'));
const ExperienceSection = React.lazy(() => import('./components/experienceSection'));
//const ProjectSection = React.lazy(() => import('./components/projectSection'));
const ChallengeSection = React.lazy(() => import('./components/challengeSection'));
const FootNote = React.lazy(() => import('./components/footNote'));
const FooterSection = React.lazy(() => import('./components/footerSection'));

const AppContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    w-full
    min-h-full
    bg-indigo-200
    text-gray-800
    dark:bg-gray-900
    dark:text-white
  `}
`;

export default function App() {
    return (
        <AppContainer>
            <Suspense fallback={<Loading />}>
                <Navbar />
                <LandingSection />
                <SkillSection />
                <LanguageSection />
                <ExperienceSection />
                {/* <ProjectSection /> */}
                <ChallengeSection />
                <FooterSection />
                <FootNote />
            </Suspense>
        </AppContainer>
    )
}