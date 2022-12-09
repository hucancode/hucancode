"use client";
import React from "react";
import { useI18n } from "locales/i18n";
import { FaFileDownload } from "react-icons/fa";
import { SiGithub, SiMinutemailer } from "react-icons/si";
import { RiFireFill } from "react-icons/ri";

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

function ContactContainer(props) {
  return (
    <div className="mb-10 flex flex-col items-center justify-start gap-3 text-sm text-gray-800 dark:text-gray-400 md:items-start">
      {props.children}
    </div>
  );
}

function ContactContainerLeft(props) {
  return (
    <div className="mb-10 flex flex-col items-center justify-start gap-3 text-sm text-gray-800 dark:text-gray-400 md:items-start">
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

export default function FooterSection() {
  const i18n = useI18n();
  let resumeUrl = i18n.locale() == "en" ? "/resume.pdf" : "/resume-jp.pdf";
  return (
    <Container>
      <ContactContainerLeft>
        <Title>{i18n.t("common.contact.contact")}</Title>
        <SocialContainer>
          <SiMinutemailer size="1.5em" style={{ marginRight: "0.5em" }} />
          <a
            className="hover:text-blue-900 hover:dark:text-blue-300"
            href="mailto:hucancode@gmail.com"
          >
            hucancode@gmail.com
          </a>
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
          <SiGithub size="1.5em" style={{ marginRight: "0.5em" }} />
          <a
            className="hover:text-blue-900 hover:dark:text-blue-300"
            target="_blank"
            rel="noreferrer"
            href="https://github.com/hucancode"
          >
            {i18n.t("common.contact.github")}
          </a>
        </SocialContainer>
        <SocialContainer>
          <RiFireFill size="1.5em" style={{ marginRight: "0.5em" }} />
          <a
            className="hover:text-blue-900 hover:dark:text-blue-300"
            target="_blank"
            rel="noreferrer"
            href="https://blog.hucanco.de"
          >
            {i18n.t("common.contact.blog")}
          </a>
        </SocialContainer>
      </ContactContainer>
    </Container>
  );
}
