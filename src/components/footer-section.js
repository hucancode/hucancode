import React from "react";
import { FaMapMarkerAlt, FaPhoneAlt, FaFileDownload } from 'react-icons/fa';
import { SiGithub, SiSketchfab, SiFacebook, SiMinutemailer, SiBuymeacoffee } from 'react-icons/si';
import { useTranslation } from 'next-i18next';
import { useRouter } from "next/router";

function Container(props)
{
    return <section className="container
        flex flex-col md:flex-row items-center md:items-start justify-around gap-3
        p-10" id={props.id}>
        {props.children}
    </section>
}

function Avatar() {
    return <div className="w-40 h-40
    relative
    rounded-full
    flex items-center justify-center
    text-white
    text-base
    mr-2
    overflow-hidden
    bg-cover
    duration-300
    bg-[url('/assets/profile-secret.jpg')]
    hover:after:left-full
    after:relative
    after:left-0
    after:bg-cover
    after:w-full
    after:h-full
    after:duration-200
    after:bg-[url('/assets/profile.jpg')]" />
}

function ContactContainer(props) {
    return <div className="contact-container">
        {props.children}
    </div>
}

function ContactContainerLeft(props) {
    return <div className="contact-container items-start">
        {props.children}
    </div>
}

function Title(props) {
    return <h1 className="text-2xl
    w-full
    text-center md:text-left text-gray-800 dark:text-white
    font-bold">
        {props.children}
    </h1>
}

function SocialContainer(props) {
    return <div className="flex justify-center md:justify-start gap-2">
        {props.children}
    </div>
}

function RoundIcon(props) {
    return <span className="w-9 h-9
        rounded-full
        bg-gray-700 hover:bg-black
        duration-300
        flex items-center justify-center
        text-white
        text-base">
        {props.children}
    </span>
}

export default function FooterSection() {
    const { t } = useTranslation();
    const router = useRouter();
    let resumeUrl = router.locale == 'en'?
        "https://resume.hucanco.de":
        "https://resume.hucanco.de/jp";
    return <Container id='contact'>
        <ContactContainer>
            <Title>{t('contact.social')}</Title>
            <SocialContainer>
                <a target="_blank" rel="noreferrer" href="https://github.com/hucancode">
                    <RoundIcon>
                        <SiGithub size="1.5em" />
                    </RoundIcon>
                </a>
                <a target="_blank" rel="noreferrer" href="https://sketchfab.com/hucancode">
                    <RoundIcon>
                        <SiSketchfab size="1.5em" />
                    </RoundIcon>
                </a>
                <a target="_blank" rel="noreferrer" href="https://www.facebook.com/hucancode">
                    <RoundIcon>
                        <SiFacebook size="1.5em" />
                    </RoundIcon>
                </a>
            </SocialContainer>
			<a target="_blank"
				rel="noreferrer"
				href="https://www.buymeacoffee.com/hucancode"
				className="rounded-md bg-gray-200 dark:bg-gray-800 flex gap-2 items-center px-4 py-2 cursor-pointer">
				<SiBuymeacoffee size="1.5em" />
				{t('contact.buymeacoffee')}
			</a>
        </ContactContainer>
        <ContactContainerLeft>
            <Title>{t('contact.contact')}</Title>
            <SocialContainer>
                <FaMapMarkerAlt size="1.5em" style={{ marginRight: "0.5em" }} />
                <p>{t('contact.address')}</p>
            </SocialContainer>
            <SocialContainer>
                <FaPhoneAlt size="1.5em" style={{ marginRight: "0.5em" }} />
                <p>(+81) 080-768-66019</p>
            </SocialContainer>
            <SocialContainer>
                <SiMinutemailer size="1.5em" style={{ marginRight: "0.5em" }} />
                <a href="mailto:hucancode@gmail.com">hucancode@gmail.com</a>
            </SocialContainer>
            <SocialContainer>
                <FaFileDownload size="1.5em" style={{ marginRight: "0.5em" }} />
                <a target="_blank" rel="noreferrer" href={resumeUrl}>{t('contact.downloadResume')}</a>
            </SocialContainer>
        </ContactContainerLeft>
        <Avatar />
    </Container>
}
