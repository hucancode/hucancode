import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { SiGithub, SiSketchfab, SiFacebook } from 'react-icons/si';
import { useTranslation } from 'next-i18next';

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        md:items-start
        justify-around
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
        hover:after:left-full
        after:relative
        after:left-0
        after:bg-cover
        after:w-full
        after:h-full
        after:duration-200
    `}
    background-image:url('/assets/profile-secret.jpg');
    &:after {
        background-image:url('/assets/profile.jpg');
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
    & a {
        ${tw`
            hover:text-blue-900
            hover:dark:text-blue-300
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

export default function FooterSection(props) {
    const { t } = useTranslation();
    return <Container id='contact'>
        <ContactContainer>
            <Title>{t('contact.social')}</Title>
            <br />
            <SocialContainer>
                <FaMapMarkerAlt size="1.5em" style={{ marginRight: "0.5em" }} />
                <p>{t('contact.address')}</p>
            </SocialContainer>
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
                <a target="_blank" rel="noreferrer" href="https://www.facebook.com/LeeSoooYoung">
                    <RoundIcon>
                        <SiFacebook size="1.5em" />
                    </RoundIcon>
                </a>
            </SocialContainer>
        </ContactContainer>
        <ContactContainer>
            <Title>{t('contact.contact')}</Title>
            <br />
            <p>(+81) 080-768-66019</p>
            <a href="mailto:hucancode@gmail.com">hucancode@gmail.com</a>
            <br />
            <a target="_blank" rel="noreferrer" href="https://docs.google.com/document/d/13RuquH_8FjIR39k3a7dr5uJn5Ml93opzPl73DiKLRHs/edit?usp=sharing">{t('contact.downloadResume')}</a>
        </ContactContainer>
        {!props.hideAvatar &&
            <Avatar />
        }
    </Container>
}
