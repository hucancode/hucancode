"use client";
import React, { useState } from "react";
import { useI18n } from "locales/i18n";
import styles from "./challenge-section.module.css";
import YoutubeVideo from "widgets/youtube";

function Container(props) {
  return (
    <section
      className="container w-full flex flex-col items-center
        py-10 md:px-10
        text-center
        overflow-hidden"
      id={props.id}
    >
    <div className="h-1 w-full max-w-sm mb-6 dark:bg-white/10 bg-gray-900/10" />
      {props.children}
    </section>
  );
}

function SectionTitle(props) {
  return (
    <h1
      className="text-2xl
        mb-5
        font-bold"
    >
      {props.children}
    </h1>
  );
}

function HistoryContainer(props) {
  return (
    <div
      className="w-full max-w-screen-lg bg-black/10 p-2
        flex flex-col md:flex-row justify-start md:aspect-[21/9]"
    >
      {props.children}
    </div>
  );
}

function HistoryNavigator(props) {
  return (
    <div
      className="flex md:flex-col
        mb-5 md:mb-0
        w-full md:w-1/3 xl:w-1/5 max-w-screen-sm
        overflow-x-auto"
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
  return <div className="flex flex-col items-start absolute bottom-0 left-0 bg-white/20 p-4">
	{props.children}
  </div>
}

function Time(props) {
  return <p className="text-xs text-left">{props.children}</p>;
}

function Description(props) {
  return <div className={styles["history-desc"]}>{props.children}</div>;
}

export default function ExperienceSection() {
  var [activeSet, setActiveSet] = useState(0);
  const i18n = useI18n();
  return (
    <Container id="experiences">
      <SectionTitle>{i18n.t("home.challenge.title")}</SectionTitle>
      <HistoryContainer>
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
				<a href="/dragon">
					<h3>{i18n.t("home.challenge.dragon")}</h3>
				</a>
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
				<a href="/sabor">
				<h3>{i18n.t("home.challenge.sabor")}</h3>
				</a>
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
				<a href="/spider">
					<h3>{i18n.t("home.challenge.spider")}</h3>
				</a>
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
