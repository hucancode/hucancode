"use client";
import React from "react";
import { useI18n } from "locales/i18n";
import styles from "./landing-section.module.css";
import MiniShowcase from "widgets/mini-showcase";

function Container(props) {
  return (
    <section
      className="relative
        my-10 flex
        w-full max-w-screen-lg flex-col items-center justify-around
        overflow-hidden
        px-10
        md:flex-row"
      id={props.id}
    >
      {props.children}
    </section>
  );
}

function About(props) {
  return (
    <div
      className="flex
    w-full flex-col items-center
    pb-10 md:relative
    md:left-0 md:w-2/5
    md:items-start"
    >
      {props.children}
    </div>
  );
}

function Greetings(props) {
  const className = `select-none text-4xl font-bold mb-4`;
  return <h1 className={className}>{props.children}</h1>;
}

function Hello(props) {
  const className =
    "text-fill-none bg-clip-text bg-double-width bg-rainbow2 animate-bg-pingpong";
  return <span className={className}>{props.children}</span>;
}

function WavingHand() {
  return <span className={styles["waving-hand"]} />;
}

function Description(props) {
  return <div className="mb-4 text-center md:text-left">{props.children}</div>;
}

export default function LandingSection() {
  const i18n = useI18n();
  return (
    <Container>
      <About>
        <Greetings>
          <Hello>{i18n.t("home.landing.hello")}</Hello>
          <WavingHand />
        </Greetings>
        <Description>{i18n.t("home.landing.about1")}</Description>
      </About>
      <MiniShowcase />
    </Container>
  );
}
