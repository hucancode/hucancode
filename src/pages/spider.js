import React from "react";
import SpiderScene from "scenes/spider";
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

export default function ProceduralSpider() {
    const { t } = useTranslation("challenge");
    return <Container>
        <Head>
            <title>{t("spider.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <ProjectMedia>
                    <SpiderScene />
                </ProjectMedia>
                <ProjectDetail>
                    <h2>{t("spider.title")}</h2>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><SiOpengl size="1.5em" /></span>
                    <Trans i18nKey="challenge:spider.description">
                        <p>Spider animations are procedurally generated using Inverse Kinematics</p>
                        <small>Spider model by <a href="https://sketchfab.com/3d-models/low-poly-spider-walk-cycle-e4d2c40b66554b10be20f61bb0610774">volkanongun</a></small>
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
