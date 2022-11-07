"use client";
import React from "react";
import { useI18n } from "locales/i18n";
import {
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaFileDownload,
  FaHackerrank,
} from "react-icons/fa";
import {
  SiGithub,
  SiLeetcode,
  SiSketchfab,
  SiMinutemailer,
  SiBuymeacoffee,
} from "react-icons/si";

function Container(props) {
  return (
    <section
      className="flex w-full
        max-w-screen-lg flex-col items-center justify-around gap-3 px-4 py-10
        md:flex-row md:items-start md:px-10"
      id={props.id}
    >
      {props.children}
    </section>
  );
}

function Avatar() {
  return (
    <div
      className="relative mr-2
    flex
    h-40
    w-40 items-center justify-center
    overflow-hidden
    rounded-full
    bg-[url('/assets/profile.jpg')]
    bg-cover
    text-base
    text-white
    duration-300
    after:relative
    after:left-0
    after:h-full
    after:w-full
    after:bg-[url('/assets/profile-3d.png')]
    after:bg-cover
    after:duration-200
    hover:after:left-full"
    />
  );
}

function ContactContainer(props) {
  return (
    <div className="mb-10 flex flex-col items-center justify-start gap-3 text-sm text-gray-800 dark:text-gray-400 md:items-start">
      {props.children}
    </div>
  );
}

function ContactContainerLeft(props) {
  return (
    <div className="mb-10 flex flex-col items-start items-center justify-start gap-3 text-sm text-gray-800 dark:text-gray-400 md:items-start">
      {props.children}
    </div>
  );
}

function Title(props) {
  return (
    <h1
      className="w-full
    text-center
    text-2xl font-bold text-gray-800 dark:text-white
    md:text-left"
    >
      {props.children}
    </h1>
  );
}

function SocialContainer(props) {
  return (
    <div className="flex justify-center gap-2 md:justify-start">
      {props.children}
    </div>
  );
}

function RoundIcon(props) {
  return (
    <span
      className="flex h-9
        w-9
        items-center justify-center
        rounded-full
        bg-gray-700 text-base text-white
        duration-300
        hover:bg-black"
    >
      {props.children}
    </span>
  );
}

export default function FooterSection() {
  const i18n = useI18n();
  let resumeUrl =
    i18n.locale() == "en"
      ? "https://resume.hucanco.de"
      : "https://resume.hucanco.de/jp";
  return (
    <Container id="contact">
      <ContactContainerLeft>
        <Title>{i18n.t("common.contact.contact")}</Title>
        <SocialContainer>
          <SiMinutemailer size="1.5em" style={{ marginRight: "0.5em" }} />
          <a href="mailto:hucancode@gmail.com">hucancode@gmail.com</a>
        </SocialContainer>
        <SocialContainer>
          <FaFileDownload size="1.5em" style={{ marginRight: "0.5em" }} />
          <a
            className="hover:text-blue-900 hover:dark:text-blue-300"
            target="_blank"
            rel="noreferrer"
            href={resumeUrl}
          >
            {i18n.t("common.contact.downloadResume")}
          </a>
        </SocialContainer>
      </ContactContainerLeft>
      <ContactContainer>
        <Title>{i18n.t("common.contact.social")}</Title>
        <SocialContainer>
          <a
            target="_blank"
            rel="noreferrer"
            href="https://github.com/hucancode"
          >
            <RoundIcon>
              <SiGithub size="1.5em" />
            </RoundIcon>
          </a>
          <a
            target="_blank"
            rel="noreferrer"
            href="https://leetcode.com/hucancode/"
          >
            <RoundIcon>
              <SiLeetcode size="1.5em" />
            </RoundIcon>
          </a>
        </SocialContainer>
      </ContactContainer>
      <Avatar />
    </Container>
  );
}
