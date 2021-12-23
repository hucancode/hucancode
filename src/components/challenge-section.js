import React from "react";
import Link from 'next/link'
import { useTranslation } from 'next-i18next';
import { SiThreedotjs, SiUnrealengine, SiUnity, SiBlender, SiOpengl } from "react-icons/si";
import { GiPuppet } from 'react-icons/gi'

function Container(props)
{
    return <section className="container
        flex flex-col items-center
        text-center
        p-10" >
        {props.children}
    </section>
}

function SectionTitle(props)
{
    return <h1 className="
        text-2xl
        mb-5
        font-bold">
        {props.children}
    </h1>
}

function ShowcaseContainer(props)
{
    return <div className="
        w-full
        grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10
        text-center
        max-w-screen-lg" >
        {props.children}
    </div>
}

function ProjectCard(props)
{
    return <div className="
        flex flex-col justify-center items-center
        text-center
        shadow-lg
        rounded-lg
        overflow-hidden">
        {props.children}
    </div>
}

function ProjectMedia(props)
{
    return <div className="
        project-media
        flex
        items-center
        w-full
        max-w-screen-md
        object-contain">
        {props.children}
    </div>
}

function ProjectDetail(props)
{
    return <div className="
        project-detail
        flex justify-between items-center gap-4
        text-left
        relative
        right-0
        w-full max-w-screen-md
        bg-indigo-100 dark:bg-gray-600
        text-gray-600 dark:text-gray-100
        object-contain
        px-4
        py-6">
        {props.children}
    </div>
}


function YoutubeVideo(props) {
    return <div className="youtube-frame">
        <iframe 
        width="853"
        height="480"
        src={`https://www.youtube.com/embed/${props.videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded youtube"
    /></div>
}

export default function ChallengeSection() {
    const { t } = useTranslation("home");
    return <Container id='challenge'>
        <SectionTitle>{t('challenge.title')}</SectionTitle>
        <ShowcaseContainer>
            <ProjectCard>
                <ProjectMedia>
                    <video autoPlay muted loop src="/assets/video/dragon-600-20s.webm" />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="dragon" passHref><h2>{t("challenge.dragon")}</h2></Link>
                        <p>{t("challenge.dragon-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiOpengl size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <video autoPlay muted loop src='/assets/video/spider-600-20s.webm' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="spider" passHref><h2>{t("challenge.spider")}</h2></Link>
                        <p>{t("challenge.spider-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiOpengl size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <video autoPlay muted loop src='/assets/video/sabor-600-20s.webm' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="sabor" passHref><h2>{t("challenge.sabor")}</h2></Link>
                        <p>{t("challenge.sabor-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><GiPuppet size="1.5em"/></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <YoutubeVideo videoId='9RCqafaFMcY' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="weapon-master" passHref><h2>{t("challenge.weapon-master")}</h2></Link>
                        <p>{t("challenge.weapon-master-sub")}</p>
                    </div>
                    <span><SiUnrealengine size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
            <ProjectCard>
                <ProjectMedia>
                    <YoutubeVideo videoId='xvNHCHPUz8A' />
                </ProjectMedia>
                <ProjectDetail>
                    <div>
                        <Link href="doll" passHref><h2>{t("challenge.doll")}</h2></Link>
                        <p>{t("challenge.doll-sub")}</p>
                    </div>
                    <span><SiUnity size="1.5em" /></span>
                </ProjectDetail>
            </ProjectCard>
        </ShowcaseContainer>
    </Container>
}