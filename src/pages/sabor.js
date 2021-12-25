import React from "react";
import SaborScene from "scenes/sabor";
import { useTranslation, Trans } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { SiThreedotjs, SiBlender, SiOpengl } from "react-icons/si";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";

function Container(props) {
    return <div className="page-container">
        {props.children}
    </div>
}

function ProjectCard(props) {
    return <div className="challenge-card">
        {props.children}
    </div>
}

function ProjectMedia(props) {
    return <div className="media-3d">
        {props.children}
    </div>
}

function ProjectDetail(props) {
    return <div className="detail">
        {props.children}
    </div>
}

export default function Sabor() {
    const { t } = useTranslation("challenge");
    return <Container>
        <Head>
            <title>{t("weapon-master.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <Head>
                    <title>{t("sabor.title")}</title>
                </Head>
                <ProjectMedia>
                    <SaborScene />
                </ProjectMedia>
                <ProjectDetail>
                    <h2>{t("sabor.title")}</h2>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><SiOpengl size="1.5em" /></span>
                    <Trans i18nKey="challenge:sabor.description">
                        <p>This is a game-ready character. Rigged and animated using Blender</p>
                    </Trans>
                </ProjectDetail>
            </ProjectCard>
        </main>
        <FootNote />
    </Container>
}

export async function getStaticProps({ locale }) {
    return {
        props: {
            ...(await serverSideTranslations(locale, ['common', 'challenge'])),
            // Will be passed to the page component as props
        },
    };
}
