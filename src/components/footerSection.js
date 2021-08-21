import React from "react";
import styled from 'styled-components';
import tw from 'twin.macro';
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArtstation, faFacebook, faGithub } from "@fortawesome/free-brands-svg-icons";

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
        rounded-full
        bg-red-500
        flex
        items-center
        justify-center
        text-white
        text-base
        mr-2
        overflow-hidden
    `}
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
`;

const Title = styled.h1`
    ${tw`
        text-2xl
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
    return <Container>
        <ContactContainer>
            <Title>Reach out to me!</Title>
            <br/>
            <SocialContainer><FontAwesomeIcon icon={faMapMarkerAlt} style={{marginRight: '0.5rem'}} size="lg"></FontAwesomeIcon><p>Marugame, Kagawa, Japan</p></SocialContainer>
            <SocialContainer>
                <RoundIcon>
                    <FontAwesomeIcon icon={faGithub} size="lg"></FontAwesomeIcon>
                </RoundIcon>
                <RoundIcon>
                    <FontAwesomeIcon icon={faArtstation} size="lg"></FontAwesomeIcon>
                </RoundIcon>
                <RoundIcon>
                    <FontAwesomeIcon icon={faFacebook} size="lg"></FontAwesomeIcon>
                </RoundIcon>
            </SocialContainer>
        </ContactContainer>
        <ContactContainer>
            <Title>Contact</Title>
            <br/>
            <p>(+81)070-8311-3362</p>
            <p>hucancode@gmail.com</p>
            <p>Download my resume</p>
        </ContactContainer>
        <Avatar>
            <img src="./assets/sol.jpg" width="100%" height="100%" />
        </Avatar>
    </Container>
}