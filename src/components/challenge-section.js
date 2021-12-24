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
        p-10" id={props.id}>
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

function ChallengeCard(props)
{
    return <div className="challenge-card-small">
        {props.children}
    </div>
}

function ChallengeMedia(props)
{
    return <div className="media">
        {props.children}
    </div>
}

function ChallengeDetail(props)
{
    return <div className="detail">
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
        />
    </div>
}

export default function ChallengeSection() {
    const { t } = useTranslation("home");
    return <Container id='challenge'>
        <SectionTitle>{t('challenge.title')}</SectionTitle>
        <ShowcaseContainer>
            <ChallengeCard>
                <ChallengeMedia>
                    <video autoPlay muted loop src="/assets/video/dragon-600-20s.webm" />
                </ChallengeMedia>
                <ChallengeDetail>
                    <div>
                        <Link href="/dragon" passHref><a><h2>{t("challenge.dragon")}</h2></a></Link>
                        <p>{t("challenge.dragon-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiOpengl size="1.5em" /></span>
                </ChallengeDetail>
            </ChallengeCard>
            <ChallengeCard>
                <ChallengeMedia>
                    <video autoPlay muted loop src='/assets/video/spider-600-20s.webm' />
                </ChallengeMedia>
                <ChallengeDetail>
                    <div>
                        <Link href="/spider" passHref><a><h2>{t("challenge.spider")}</h2></a></Link>
                        <p>{t("challenge.spider-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiOpengl size="1.5em" /></span>
                </ChallengeDetail>
            </ChallengeCard>
            <ChallengeCard>
                <ChallengeMedia>
                    <video autoPlay muted loop src='/assets/video/sabor-600-20s.webm' />
                </ChallengeMedia>
                <ChallengeDetail>
                    <div>
                        <Link href="/sabor" passHref><a><h2>{t("challenge.sabor")}</h2></a></Link>
                        <p>{t("challenge.sabor-sub")}</p>
                    </div>
                    <span><SiThreedotjs size="1.5em" /><SiBlender size="1.5em" /><GiPuppet size="1.5em"/></span>
                </ChallengeDetail>
            </ChallengeCard>
            <ChallengeCard>
                <ChallengeMedia>
                    <YoutubeVideo videoId='9RCqafaFMcY' />
                </ChallengeMedia>
                <ChallengeDetail>
                    <div>
                        <Link href="/weapon-master" passHref><a><h2>{t("challenge.weapon-master")}</h2></a></Link>
                        <p>{t("challenge.weapon-master-sub")}</p>
                    </div>
                    <span><SiUnrealengine size="1.5em" /></span>
                </ChallengeDetail>
            </ChallengeCard>
            <ChallengeCard>
                <ChallengeMedia>
                    <YoutubeVideo videoId='xvNHCHPUz8A' />
                </ChallengeMedia>
                <ChallengeDetail>
                    <div>
                        <Link href="/doll" passHref><a><h2>{t("challenge.doll")}</h2></a></Link>
                        <p>{t("challenge.doll-sub")}</p>
                    </div>
                    <span><SiUnity size="1.5em" /></span>
                </ChallengeDetail>
            </ChallengeCard>
        </ShowcaseContainer>
    </Container>
}