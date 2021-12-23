import React from "react";
import { useTranslation, Trans } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head'
import { SiBlender, SiCplusplus, SiUnrealengine } from "react-icons/si";
import Navbar from "../components/navigation-bar";
import YoutubeVideo from "../widgets/youtube";
import FootNote from "../components/foot-note";

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
    return <div className="detail">
        {props.children}
    </div>
}


export default function ProceduralDragon() {
    const { t } = useTranslation("challenge");
    return <Container>
        <Head>
            <title>{t("weapon-master.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <Head>
                    <title>{t("weapon-master.title")}</title>
                </Head>
                <YoutubeFrame>
                    <YoutubeVideo videoId='9RCqafaFMcY' />
                </YoutubeFrame>

                <ProjectDetail>
                    <h2>{t("weapon-master.title")}</h2>
                    <span><SiUnrealengine size="1.5em" /><SiBlender size="1.5em" /><SiCplusplus size="1.5em" /></span>
                    <Trans i18nKey="challenge:weapon-master.description">
                        <p>This is small RPG made with Unreal Engine, featuring 10+ switchable weapons.</p>
                        <ul>
                            <li>Each weapon has unique skill set. Weapon has it&apos;s own animation logic and completely independent from character logic.</li>
                            <li>Full locomotion animation. Dashing, Jumping, Sprinting, Flying.</li>
                            <li>Some skill has interaction with locomotion state, try swing a sword while in air or quickly hit while dashing.</li>
                            <li>Featuring hit react system. Player get stunned when hit. High impact skill knocks down enemy dramatically using ragdoll physics.</li>
                        </ul>
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
