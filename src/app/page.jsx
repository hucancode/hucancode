import React from "react";
import LandingSection from "components/landing-section";
import FooterSection from "components/footer-section";
import LeetcodeSection from "components/leetcode-section";
import FootNote from "components/foot-note";

export default function Home() {
  return (
    <>
      <LandingSection />
      <LeetcodeSection />
      <FooterSection />
      <FootNote />
    </>
  );
}
