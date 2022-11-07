"use client";
import React, { useState } from "react";
import { useI18n } from "locales/i18n";
import styles from "./challenge-section.module.css";
import YoutubeVideo from "widgets/youtube";
import { BsArrowBarDown } from "react-icons/bs";
import Link from "next/link";

function Container(props) {
  return (
    <section
      className="flex w-full max-w-screen-lg flex-col items-center
        overflow-hidden py-10 px-4
        text-center
        md:px-10"
      id={props.id}
    >
      <div className="mb-6 h-1 w-full max-w-sm bg-gray-900/10 dark:bg-white/10" />
      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return (
    <h1
      className="mb-5
        text-2xl
        font-bold"
    >
      {props.children}
    </h1>
  );
}

function SectionExpandButton(props) {
  if (!props.active) {
    return <></>;
  }
  return (
    <button onClick={props.onClick}>
      <div className="animate-bounce">
        <BsArrowBarDown size="2em" />
      </div>
    </button>
  );
}
function HistoryContainer(props) {
  if (!props.active) {
    return <></>;
  }
  return (
    <div
      className="flex w-full max-w-screen-lg flex-col
	  justify-start
        overflow-hidden bg-black/10 p-2 md:aspect-[21/9] md:flex-row"
    >
      {props.children}
    </div>
  );
}

function HistoryNavigator(props) {
  return (
    <div
      className="mb-5 flex
        w-full overflow-x-auto
        md:mb-0
        md:flex-col"
    >
      {props.children}
    </div>
  );
}

function HistoryButton(props) {
  return (
    <button
      className={styles["history-button"]}
      onClick={props.onClick}
      active={props.active ? "true" : undefined}
    >
      {props.children}
    </button>
  );
}

function ContentContainer(props) {
  return (
    <div
      className={styles["history-content"]}
      active={props.active ? "true" : undefined}
    >
      {props.children}
    </div>
  );
}

function Title(props) {
  return (
    <div className="absolute bottom-0 left-0 flex flex-col items-start bg-white/20 p-4">
      {props.children}
    </div>
  );
}

function Time(props) {
  return <p className="text-left text-xs">{props.children}</p>;
}

function Description(props) {
  return <div className={styles["history-desc"]}>{props.children}</div>;
}

export default function ChallengeSection() {
  var [activeSet, setActiveSet] = useState(0);
  var [isHidden, setHidden] = useState(true);
  const i18n = useI18n();
  return (
    <Container>
      <SectionTitle>{i18n.t("home.challenge.title")}</SectionTitle>
      <SectionExpandButton active={isHidden} onClick={() => setHidden(false)} />
      <HistoryContainer active={!isHidden}>
        <HistoryNavigator>
          <HistoryButton
            onClick={() => setActiveSet(0)}
            active={activeSet === 0}
          >
            <h3>{i18n.t("home.challenge.dragon")}</h3>
          </HistoryButton>
          <HistoryButton
            onClick={() => setActiveSet(1)}
            active={activeSet === 1}
          >
            <h3>{i18n.t("home.challenge.sabor")}</h3>
          </HistoryButton>
          <HistoryButton
            onClick={() => setActiveSet(2)}
            active={activeSet === 2}
          >
            <h3>{i18n.t("home.challenge.spider")}</h3>
          </HistoryButton>
          <HistoryButton
            onClick={() => setActiveSet(3)}
            active={activeSet === 3}
          >
            <h3>{i18n.t("home.challenge.weapon-master")}</h3>
          </HistoryButton>
          <HistoryButton
            onClick={() => setActiveSet(4)}
            active={activeSet === 4}
          >
            <h3>{i18n.t("home.challenge.doll")}</h3>
          </HistoryButton>
        </HistoryNavigator>
        <ContentContainer active={activeSet === 0}>
          <Description>
            <video
              className="aspect-[4/3] h-full"
              autoPlay
              muted
              loop
              src="/assets/video/dragon-600-20s.webm"
            />
          </Description>
          <Title>
            <Link href="/dragon">
              <h3>{i18n.t("home.challenge.dragon")}</h3>
            </Link>
            <small>{i18n.t("home.challenge.dragon-sub")}</small>
          </Title>
        </ContentContainer>
        <ContentContainer active={activeSet === 1}>
          <Description>
            <video
              className="aspect-[4/3] h-full"
              autoPlay
              muted
              loop
              src="/assets/video/sabor-600-20s.webm"
            />
          </Description>
          <Title>
            <Link href="/sabor">
              <h3>{i18n.t("home.challenge.sabor")}</h3>
            </Link>
            <small>{i18n.t("home.challenge.sabor-sub")}</small>
          </Title>
        </ContentContainer>
        <ContentContainer active={activeSet === 2}>
          <Description>
            <video
              className="aspect-[4/3] h-full"
              autoPlay
              muted
              loop
              src="/assets/video/spider-600-20s.webm"
            />
          </Description>
          <Title>
            <Link href="/spider">
              <h3>{i18n.t("home.challenge.spider")}</h3>
            </Link>
            <small>{i18n.t("home.challenge.spider-sub")}</small>
          </Title>
        </ContentContainer>
        <ContentContainer active={activeSet === 3}>
          <Description>
            <YoutubeVideo videoId="9RCqafaFMcY" />
          </Description>
        </ContentContainer>
        <ContentContainer active={activeSet === 4}>
          <Description>
            <YoutubeVideo videoId="xvNHCHPUz8A" />
          </Description>
        </ContentContainer>
      </HistoryContainer>
    </Container>
  );
}
