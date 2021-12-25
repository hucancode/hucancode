import React from "react";
import DragonScene from "scenes/dragon";
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

export default function ProceduralDragon() {
    const { t } = useTranslation("challenge");
    return <Container>
        <Head>
            <title>{t("dragon.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <ProjectMedia>
                    <DragonScene />
                </ProjectMedia>
                <ProjectDetail>
                    <h2>{t("dragon.title")}</h2>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><SiOpengl size="1.5em" /></span>
                    <Trans i18nKey="challenge:dragon.description">
                        <p>Dragon animations are procedurally generated with following steps:</p>
                        <ul>
                            <li>Load static dragon mesh. Posed in a straight line</li>
                            <li>Build a curve using THREE.CatmullRomCurve3</li>
                            <li>Pass curve data down to GPU via a texture</li>
                            <li>Inside vertex shader, read texture data and set vertex position accordingly</li>
                        </ul>
                        <small>Dragon model by <a href="https://sketchfab.com/3d-models/chinese-dragon-fa05f2a6596041938152a84a956212e0">youmeowmeow</a></small>.
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
