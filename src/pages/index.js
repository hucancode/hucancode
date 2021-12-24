import React from 'react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head'
import Navbar from "../components/navigation-bar";
import LandingSection from "../components/landing-section";
import SkillSection from "../components/skill-section";
import LanguageSection from "../components/language-section";
import ExperienceSection from "../components/experience-section";
import ChallengeSection from "../components/challenge-section";
import FootNote from "../components/foot-note";
import FooterSection from "../components/footer-section";
function Container(props) {
    return <div className='page-container'>
        {props.children}
    </div>
}
export default function Home() {
  return <Container>
        <Head>
          <title>hucancode</title>
        </Head>
        <Navbar />
        <main>
            <LandingSection />
            <SkillSection />
            <LanguageSection />
            <ExperienceSection />
            <ChallengeSection />
            <FooterSection />
        </main>
        <FootNote />
    </Container>
}

export async function getStaticProps({ locale }) {
    return {
      props: {
        ...(await serverSideTranslations(locale, ['common', 'home'])),
        // Will be passed to the page component as props
      },
    };
  }
