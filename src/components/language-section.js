import React, { useState } from "react";
import { useTranslation } from 'next-i18next';
import SwitchButton from "../widgets/switchButton";
import { FcReading, FcVoicePresentation } from "react-icons/fc";
import { RiStarFill, RiStarHalfFill, RiStarLine } from "react-icons/ri";

function Container(props) {
    return <section className="container
        flex flex-col items-center
        py-10 md:px-10
        text-center
        overflow-hidden">
        {props.children}
    </section>
}

function SectionTitle(props) {
    return <h1 className="text-2xl mb-5 font-bold">
        {props.children}
    </h1>
}

function LanguageContainer(props) {
    return <div className="language-container">
        {props.children}
    </div>
}

function LanguageScore(props) {
    return <div className="language-score">
        {props.children}
    </div>
}

function LanguageRating(props) {
    return <div className="language-rating">
        {props.children}
    </div>
}

export default function LanguageSection() {
    var [activeLanguage, setActiveLanguage] = useState(false);
    const { t } = useTranslation("home");

    return <Container id='language'>
        <SectionTitle>{t('languages.title')}</SectionTitle>
        <SwitchButton
            inputId="switchLang"
            labelA={t('languages.english')}
            labelB={t('languages.japanese')}
            onChange={(value) => setActiveLanguage(value)}>
        </SwitchButton>
        <LanguageContainer active={!activeLanguage}>
            <LanguageScore>
                <h3>
                    945/990
                </h3>
                <p>TOEIC</p>
            </LanguageScore>
            <LanguageRating>
                <FcReading size="3em" />
                <p>
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarHalfFill size="1.5em" />
                </p>
            </LanguageRating>
            <LanguageRating>
                <FcVoicePresentation size="3em" />
                <p>
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarLine size="1.5em" />
                </p>
            </LanguageRating>
        </LanguageContainer>
        <LanguageContainer active={activeLanguage}>
            <LanguageScore>
                <h3>
                    118/180
                </h3>
                <p>JLPT N2</p>
            </LanguageScore>
            <LanguageRating>
                <FcReading size="3em" />
                <p>
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarLine size="1.5em" />
                    <RiStarLine size="1.5em" />
                </p>
            </LanguageRating>
            <LanguageRating>
                <FcVoicePresentation size="3em" />
                <p>
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarFill size="1.5em" />
                    <RiStarHalfFill size="1.5em" />
                    <RiStarLine size="1.5em" />
                </p>
            </LanguageRating>
        </LanguageContainer>
    </Container>
}