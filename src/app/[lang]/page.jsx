"use client";
import React, { useEffect } from "react";
import LandingSection from "components/landing-section";
import SkillSection from "components/skill-section";
import LanguageSection from "components/language-section";
import ExperienceSection from "components/experience-section";
import ChallengeSection from "components/challenge-section";
import FooterSection from "components/footer-section";
import useI18n from "locales/use-i18n";
import EN from "locales/en.json";
import JP from "locales/jp.json";

export default function Home({ lang }) {
  const i18n = useI18n();
  useEffect(() => {
    if (lang === "jp") {
      i18n.locale("jp", JP);
    } else {
      i18n.locale("en", EN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <LandingSection />
      <SkillSection />
      <LanguageSection />
      <ExperienceSection />
      <ChallengeSection />
      <FooterSection />
    </>
  );
}
