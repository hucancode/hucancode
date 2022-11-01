"use client";
import React, { useEffect } from "react";
import LandingSection from "components/landing-section";
import SkillSection from "components/skill-section";
import LanguageSection from "components/language-section";
import ExperienceSection from "components/experience-section";
import ChallengeSection from "components/challenge-section";
import FooterSection from "components/footer-section";
import useI18n from "locales/use-i18n";

async function setLanguage(lang, i18n) {
  if (lang === "jp") {
    const JP = await import("locales/jp.json");
    i18n.locale("jp", JP);
    console.log("set language to JP");
  } else {
    const EN = await import("locales/en.json");
    i18n.locale("en", EN);
    console.log("set language to EN");
  }
}
export default function Home({ params }) {
  const { lang } = params;
  const i18n = useI18n();
  useEffect(() => {
    setLanguage(lang, i18n);
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
