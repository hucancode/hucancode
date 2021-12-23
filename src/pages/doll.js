import React from "react";
import { useTranslation, Trans } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head'
import { SiCsharp, SiUnity } from "react-icons/si";
import Navbar from "../components/navigation-bar";
import YoutubeVideo from "../widgets/youtube";
import FootNote from "../components/foot-note";
import '../styles/challenge.css';

function Container(props) {
    return <div className="container-challenge">
        {props.children}
    </div>
}

function ProjectCard(props) {
    return <div className="challenge-card">
        {props.children}
    </div>
}

function YoutubeFrame(props) {
    return <div className="media">
        {props.children}
    </div>
}

function ProjectDetail(props) {
    <div className="detail">
        {props.children}
    </div>
}

export default function ProceduralDragon() {
    const { t } = useTranslation('challenge');
    return <Container>
        <Head>
            <title>{t("doll.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <Head>
                    <title>{t("doll.title")}</title>
                </Head>
                <YoutubeFrame>
                    <YoutubeVideo videoId='xvNHCHPUz8A' />
                </YoutubeFrame>
                <ProjectDetail>
                    <h2>{t("doll.title")}</h2>
                    <span><SiUnity size="1.5em" /><SiCsharp size="1.5em" /></span>
                    <Trans i18nKey="challenge:doll.description">
                        <p>Small top down shooter game made with Unity, featuring a laser gun and alot of fearsome &quot;monster&quot;.</p>
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
