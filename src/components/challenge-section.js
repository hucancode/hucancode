"use client";
import React from "react";
// import Link from "next/link";
import {
  SiThreedotjs,
  SiUnrealengine,
  SiUnity,
  SiBlender,
  SiOpengl,
} from "react-icons/si";
import YoutubeVideo from "widgets/youtube";
import { GiPuppet } from "react-icons/gi";
import { useI18n } from "locales/i18n";
import styles from "./challenge-section.module.css";

function Link(props) {
	return <a href={props.href}>
		{props.children}
	</a>
}
function Container(props) {
  return (
    <section
      className="container
        flex flex-col items-center
        text-center
        p-10"
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
      className="
        text-2xl
        mb-5
        font-bold"
    >
      {props.children}
    </h1>
  );
}

function ShowcaseContainer(props) {
  return (
    <div
      className="
        w-full
        grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10
        text-center
        max-w-screen-lg"
    >
      {props.children}
    </div>
  );
}

function ChallengeCard(props) {
  return <div className={styles["challenge-card-small"]}>{props.children}</div>;
}

function ChallengeMedia(props) {
  return <div className={styles["media"]}>{props.children}</div>;
}

function ChallengeDetail(props) {
  return <div className={styles["detail"]}>{props.children}</div>;
}

export default function ChallengeSection() {
  const i18n = useI18n();
  return (
    <Container id="challenge">
      <SectionTitle>{i18n.t("home.challenge.title")}</SectionTitle>
      <ShowcaseContainer>
        <ChallengeCard>
          <ChallengeMedia>
            <video
              autoPlay
              muted
              loop
              src="/assets/video/dragon-600-20s.webm"
            />
          </ChallengeMedia>
          <ChallengeDetail>
            <div>
              <Link href={`${i18n.locale()}/dragon`}>
                <h2>{i18n.t("home.challenge.dragon")}</h2>
              </Link>
              <p>{i18n.t("home.challenge.dragon-sub")}</p>
            </div>
            <span>
              <SiThreedotjs size="1.5em" />
              <SiOpengl size="1.5em" />
            </span>
          </ChallengeDetail>
        </ChallengeCard>
        <ChallengeCard>
          <ChallengeMedia>
            <video
              autoPlay
              muted
              loop
              src="/assets/video/spider-600-20s.webm"
            />
          </ChallengeMedia>
          <ChallengeDetail>
            <div>
              <Link href={`${i18n.locale()}/spider`}>
                <h2>{i18n.t("home.challenge.spider")}</h2>
              </Link>
              <p>{i18n.t("home.challenge.spider-sub")}</p>
            </div>
            <span>
              <SiThreedotjs size="1.5em" />
              <SiOpengl size="1.5em" />
            </span>
          </ChallengeDetail>
        </ChallengeCard>
        <ChallengeCard>
          <ChallengeMedia>
            <video autoPlay muted loop src="/assets/video/sabor-600-20s.webm" />
          </ChallengeMedia>
          <ChallengeDetail>
            <div>
              <Link href={`${i18n.locale()}/sabor`}>
                <h2>{i18n.t("home.challenge.sabor")}</h2>
              </Link>
              <p>{i18n.t("home.challenge.sabor-sub")}</p>
            </div>
            <span>
              <SiThreedotjs size="1.5em" />
              <SiBlender size="1.5em" />
              <GiPuppet size="1.5em" />
            </span>
          </ChallengeDetail>
        </ChallengeCard>
        <ChallengeCard>
          <ChallengeMedia>
            <YoutubeVideo videoId="9RCqafaFMcY" />
          </ChallengeMedia>
          <ChallengeDetail>
            <div>
              <Link href={`${i18n.locale()}/weapon-master`}>
                <h2>{i18n.t("home.challenge.weapon-master")}</h2>
              </Link>
              <p>{i18n.t("home.challenge.weapon-master-sub")}</p>
            </div>
            <span>
              <SiUnrealengine size="1.5em" />
            </span>
          </ChallengeDetail>
        </ChallengeCard>
        <ChallengeCard>
          <ChallengeMedia>
            <YoutubeVideo videoId="xvNHCHPUz8A" />
          </ChallengeMedia>
          <ChallengeDetail>
            <div>
              <Link href={`${i18n.locale()}/doll`}>
                <h2>{i18n.t("home.challenge.doll")}</h2>
              </Link>
              <p>{i18n.t("home.challenge.doll-sub")}</p>
            </div>
            <span>
              <SiUnity size="1.5em" />
            </span>
          </ChallengeDetail>
        </ChallengeCard>
      </ShowcaseContainer>
    </Container>
  );
}
