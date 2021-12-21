import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from 'next-i18next';
import { faBook, faHeadphones, faStar, faStarHalfAlt } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarEmpty }  from "@fortawesome/free-regular-svg-icons";
import SwitchButton from "../widgets/switchButton";

const Container = styled.section`
    ${tw`
        container
        flex
        flex-col
        items-center
        pt-10
        pb-10
        md:p-10
        text-center
        overflow-hidden
    `}
`;
const SectionTitle = styled.h1`
    ${tw`
        text-2xl
        mb-5
        font-bold
    `}
`;

const LanguageContainer = styled.div`
    ${tw`
        w-full
        relative
        h-32
        max-w-screen-md
        flex
        flex-wrap
        items-center
        justify-center
        duration-300
        origin-top
        overflow-hidden
    `}
    ${props => props.active ? `` : `height:0;`}
`;

const LanguageScoreMain = styled.div`
    ${tw`
        w-1/3
        h-full
        flex
        flex-col
        items-center
        justify-between
        bg-white
        dark:bg-gray-500
        text-black
        dark:text-gray-100
        p-5
    `}
    h3 {
        ${tw`
            text-purple-800
            dark:text-yellow-100
            text-lg
            md:text-2xl
            font-bold
        `}
    }
    p {
        ${tw`
            text-sm
            font-bold
        `}
    }
`;

const LanguageScoreDetail = styled.div`
    ${tw`
        w-1/3
        h-full
        flex
        flex-col
        items-center
        justify-between
        bg-blue-100
        dark:bg-gray-700
        text-gray-700
        dark:text-gray-200
        p-5
    `}
    p {
        ${tw`
            text-sm
            font-bold
        `}
    }
`;

export default function LanguageSection() {
    var [activeLanguage, setActiveLanguage] = useState(false);
    const { t } = useTranslation();
    
    return <Container id='language'>
        <SectionTitle>{t('languages.title')}</SectionTitle>
        <SwitchButton 
            inputId="switchLang"
            labelA={t('languages.english')}
            labelB={t('languages.japanese')}
            onChange={(value) => setActiveLanguage(value)}>
        </SwitchButton>
        <LanguageContainer active={!activeLanguage}>
            <LanguageScoreMain>
                <h3>
                    945/990
                </h3>
                <p>TOEIC</p>
            </LanguageScoreMain>
            <LanguageScoreDetail>
                <FontAwesomeIcon icon={faBook} size="2x"></FontAwesomeIcon>
                <p>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStarHalfAlt} size="sm"></FontAwesomeIcon>
                </p>
            </LanguageScoreDetail>
            <LanguageScoreDetail>
                <FontAwesomeIcon icon={faHeadphones} size="2x"></FontAwesomeIcon>
                <p>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStarHalfAlt} size="sm"></FontAwesomeIcon>
                </p>
            </LanguageScoreDetail>
        </LanguageContainer>
        <LanguageContainer active={activeLanguage}>
            <LanguageScoreMain>
                <h3>
                    118/180
                </h3>
                <p>JLPT N2</p>
            </LanguageScoreMain>
            <LanguageScoreDetail>
                <FontAwesomeIcon icon={faBook} size="2x"></FontAwesomeIcon>
                <p>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStarEmpty} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStarEmpty} size="sm"></FontAwesomeIcon>
                </p>
            </LanguageScoreDetail>
            <LanguageScoreDetail>
                <FontAwesomeIcon icon={faHeadphones} size="2x"></FontAwesomeIcon>
                <p>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStar} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStarHalfAlt} size="sm"></FontAwesomeIcon>
                    <FontAwesomeIcon icon={faStarEmpty} size="sm"></FontAwesomeIcon>
                </p>
            </LanguageScoreDetail>
        </LanguageContainer>
    </Container>
}