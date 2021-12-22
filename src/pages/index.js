import React from 'react';
import styled from "styled-components";
import tw from 'twin.macro';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head'
import Navbar from "../components/navigation-bar";
import LandingSection from "../components/landing-section";
import SkillSection from "../components/skill-section";
import LanguageSection from "../components/language-section";
import ExperienceSection from "../components/experience-section";
// import ProjectSection from "../components/projectSection";
import ChallengeSection from "../components/challenge-section";
import FootNote from "../components/foot-note";
import FooterSection from "../components/footer-section";


const AppContainer = styled.div`
  ${tw`
    flex flex-col items-center
    w-full min-h-full
    bg-indigo-200 dark:bg-gray-900
    text-gray-800 dark:text-white
  `}
`;

export default function Home() {
  return <AppContainer>
        <Head>
          <title>hucancode</title>
        </Head>
        <Navbar />
        <LandingSection />
        <SkillSection />
        <LanguageSection />
        <ExperienceSection />
        {/* <ProjectSection /> */}
        <ChallengeSection />
        <FooterSection />
        <FootNote />
    </AppContainer>
}

export async function getStaticProps({ locale }) {
    return {
      props: {
        ...(await serverSideTranslations(locale, ['common', 'home'])),
        // Will be passed to the page component as props
      },
    };
  }
