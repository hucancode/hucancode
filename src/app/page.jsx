import React from "react";
import LandingSection from "components/landing-section";
import SkillSection from "components/skill-section";
// import LanguageSection from "components/language-section";
// import ExperienceSection from "components/experience-section";
import ChallengeSection from "components/challenge-section";
import FooterSection from "components/footer-section";
import LeetcodeSection, { loadContestStats } from "components/leetcode-section";

export default async function Home() {
	//console.log(loadContestStats);
	let data = await loadContestStats();
  return (
    <>
      <LandingSection />
	  <LeetcodeSection />
    {/*<SkillSection />*/}
    </>
  );
}
