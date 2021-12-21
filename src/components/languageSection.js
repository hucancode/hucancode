import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from 'next-i18next';
import { faBook, faHeadphones, faStar, faStarHalfAlt } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarEmpty }  from "@fortawesome/free-regular-svg-icons";

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

const SkillSwitchContainer = styled.div`
    ${tw`
        w-full
        flex
        items-center
        justify-center
    `}
`;

const SwitchButton = styled.input`
    height: 0;
    width: 0;
    visibility: hidden;
`;
const SwitchLabel = styled.h3`
    ${tw`
        w-1/3
        cursor-pointer
        select-none
        text-xs
        md:text-base
        duration-300
    `}
    ${props => props.active ?  
        css`${tw`
            text-blue-500
        `}` :
        css`${tw`
            text-gray-400
            hover:text-blue-500
        `}`
    }
`;
const SwitchButtonGraphic = styled.label`
    ${tw`
        bg-blue-300
        w-20
        h-8
        rounded-2xl
        cursor-pointer
        block
    `}
    position: relative;
    margin: 1rem;
        
    &:after {
        content: '';
        ${tw`
            absolute
            duration-300
            bg-white
            top-1
            left-1
            w-6
            h-6
            rounded-full
        `}
    }

    input:checked + & {
        ${tw`
            bg-green-300
        `}
    }
    input:checked + &:after {
        left: calc(100% - 0.2rem);
        transform: translateX(-100%);
    }
    &:active:after {
        width: 60%;
    }
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
        <SkillSwitchContainer>
            <SwitchLabel active={!activeLanguage} onClick={() => setActiveLanguage(false)}>{t('languages.english')}</SwitchLabel>
            <SwitchButton id="switchLang" type="checkbox" checked={activeLanguage} onChange={() => setActiveLanguage(!activeLanguage)} /><SwitchButtonGraphic htmlFor="switchLang"/>
            <SwitchLabel active={activeLanguage} onClick={() => setActiveLanguage(true)}>{t('languages.japanese')}</SwitchLabel>
        </SkillSwitchContainer>
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