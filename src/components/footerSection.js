import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { faCube, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebook, faGithub } from "@fortawesome/free-brands-svg-icons";
import { useTranslation } from 'react-i18next';

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        md:items-start
        justify-between
        p-10
        md:flex-row
    `}
`;

const Avatar = styled.div`
    ${tw`
        w-40
        h-40
        relative
        rounded-full
        flex
        items-center
        justify-center
        text-white
        text-base
        mr-2
        overflow-hidden
        bg-cover
        duration-300
    `}
    background-image: url('./assets/profile-secret.jpg');
    &:hover:after {
        ${tw`
            left-full
        `}
    }
    &:after {
        background-image: url('./assets/profile.jpg');
        content:"";
        ${tw`
            relative
            left-0
            bg-cover
            w-full
            h-full
            duration-200
        `}
    }
    
`;

const ContactContainer = styled.div`
    ${tw`
        flex
        flex-col
        mb-10
        text-sm
        items-center
        md:items-start
    `}
    & a:hover {
        ${tw`
            text-blue-900
            dark:text-blue-300
        `}
    }
`;

const Title = styled.h1`
    ${tw`
        text-2xl
        font-bold
    `}
`;
const SocialContainer = styled.div`
    ${tw`
        mt-5
        flex
    `}
`;

const RoundIcon = styled.span`
    ${tw`
        w-9
        h-9
        rounded-full
        bg-gray-700
        hover:bg-black
        duration-300
        flex
        items-center
        justify-center
        text-white
        text-base
        mr-2
    `}
`;

export default function FooterSection() {
    const { t } = useTranslation();
    return <Container id='contact'>
        <ContactContainer>
            <Title>{t('contact.social')}</Title>
            <br/>
            <SocialContainer>
                <FontAwesomeIcon icon={faMapMarkerAlt} style={{marginRight: '0.5rem'}} size="lg" />
                <p>{t('contact.address')}</p>
            </SocialContainer>
            <SocialContainer>
                <a target="_blank" rel="noreferrer" href="https://github.com/hucancode">
                <RoundIcon>
                    <FontAwesomeIcon icon={faGithub} size="lg"/>
                </RoundIcon>
                </a>
                <a target="_blank" rel="noreferrer" href="https://sketchfab.com/hucancode">
                <RoundIcon>
                    <FontAwesomeIcon icon={faCube} size="lg"/>
                </RoundIcon>
                </a>
                <a target="_blank" rel="noreferrer" href="https://www.facebook.com/LeeSoooYoung">
                <RoundIcon>
                    <FontAwesomeIcon icon={faFacebook} size="lg"/>
                </RoundIcon>
                </a>
            </SocialContainer>
        </ContactContainer>
        <ContactContainer>
            <Title>{t('contact.contact')}</Title>
            <br/>
            <p>(+81) 070-8311-3362</p>
            <a href="mailto:hucancode@gmail.com">hucancode@gmail.com</a>
            <br />
            <a target="_blank" rel="noreferrer" href="https://docs.google.com/document/d/13RuquH_8FjIR39k3a7dr5uJn5Ml93opzPl73DiKLRHs/edit?usp=sharing">{t('contact.downloadResume')}</a>
        </ContactContainer>
        <Avatar/>
    </Container>
}