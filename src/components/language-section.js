"use client";
import React, { useState } from "react";
import SwitchButton from "widgets/switch-button";
import { FcReading, FcVoicePresentation } from "react-icons/fc";
import { RiStarFill, RiStarHalfFill, RiStarLine } from "react-icons/ri";
import { useI18n } from "locales/i18n";
import styles from "./language-section.module.css";

function Container(props) {
  return (
    <section
      className="container
        flex flex-col items-center
        overflow-hidden py-10
        text-center
        md:px-10"
      id={props.id}
    >
      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return <h1 className="mb-5 text-2xl font-bold">{props.children}</h1>;
}

function LanguageContainer(props) {
  return (
    <div
      className={styles["language-container"]}
      active={props.active ? "true" : undefined}
    >
      {props.children}
    </div>
  );
}

function LanguageScore(props) {
  return <div className={styles["language-score"]}>{props.children}</div>;
}

function LanguageRating(props) {
  return <div className={styles["language-rating"]}>{props.children}</div>;
}

export default function LanguageSection() {
  var [activeLanguage, setActiveLanguage] = useState(false);
  const i18n = useI18n();
  return (
    <Container id="language">
      <SectionTitle>{i18n.t("home.languages.title")}</SectionTitle>
      <SwitchButton
        inputId="switchLang"
        labelA={i18n.t("home.languages.english")}
        labelB={i18n.t("home.languages.japanese")}
        onChange={(value) => setActiveLanguage(value)}
      ></SwitchButton>
      <LanguageContainer active={!activeLanguage}>
        <LanguageScore>
          <h3>945/990</h3>
          <p>TOEIC</p>
        </LanguageScore>
        <LanguageRating>
          <FcReading size="3em" />
          <small>{i18n.t("home.languages.rw")}</small>
          <div>
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarHalfFill size="1.4em" />
          </div>
        </LanguageRating>
        <LanguageRating>
          <FcVoicePresentation size="3em" />
          <small>{i18n.t("home.languages.ls")}</small>
          <div>
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarLine size="1.4em" />
          </div>
        </LanguageRating>
      </LanguageContainer>
      <LanguageContainer active={activeLanguage}>
        <LanguageScore>
          <h3>118/180</h3>
          <p>JLPT N2</p>
        </LanguageScore>
        <LanguageRating>
          <FcReading size="3em" />
          <small>{i18n.t("home.languages.rw")}</small>
          <div>
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarLine size="1.4em" />
            <RiStarLine size="1.4em" />
          </div>
        </LanguageRating>
        <LanguageRating>
          <FcVoicePresentation size="3em" />
          <small>{i18n.t("home.languages.ls")}</small>
          <div>
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarFill size="1.4em" />
            <RiStarHalfFill size="1.4em" />
            <RiStarLine size="1.4em" />
          </div>
        </LanguageRating>
      </LanguageContainer>
    </Container>
  );
}
