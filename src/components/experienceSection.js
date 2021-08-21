import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';
import { ReactComponent as ConstructionIllustration } from "../assets/gummy-canvas.svg";

const Container = styled.div`
    ${tw`
        container
        flex
        flex-col
        items-center
        p-10
        text-center
        overflow-hidden
    `}
`;

const SectionTitle = styled.h1`
    ${tw`
        text-2xl
        mb-5
    `}
`;

const HistoryContainer = styled.div`
    ${tw`
        w-full
        flex
        flex-col
        md:flex-row
        justify-start
    `}
`;

const HistoryNavigator = styled.div`
    ${tw`
        flex
        mb-5
        md:flex-col
        md:mb-0
        md:mr-5
        md:w-1/3
        xl:w-1/5
        overflow-y-auto	
    `}
`;

const HistoryButton = styled.button`
    ${tw`
        h-16
        md:h-10
        flex
        pl-4
        pr-4
        pt-2
        pb-2
        m-1
        duration-300
        text-white
        dark:text-gray-300
    `}
    ${props => props.active ? 
        css`${tw`
            bg-black
        `}` : 
        css`${tw`
            bg-gray-500
        `}`
    }
`;

const ContentContainer = styled.div`
    ${tw`
        flex
        flex-col
        items-start
        duration-300
    `}
    ${props => props.active ? "" : "display:none;"}
`;

const Title = styled.h3`
    ${tw`
        text-base
        text-left
    `}
`;

const Time = styled.p`
    ${tw`
        text-sm
        text-left
        font-mono
    `}
`;

const Description = styled.p`
    ${tw`
        text-sm
        text-left
        mt-5
    `}
`;

const UnderConstruction = styled(ConstructionIllustration)`
    ${tw`
        w-60
        h-60
    `}
`;

export default function ExperienceSection() {
    return <Container>
        <SectionTitle>Where I’ve worked</SectionTitle>
        <UnderConstruction/>
    </Container>
}

export function ExperienceSectionWIP() {
    var [activeSet, setActiveSet] = useState(0);
    return <Container>
        <SectionTitle>Where I’ve worked</SectionTitle>
        <HistoryContainer style={{display:"none"}}>
            <HistoryNavigator>
                <HistoryButton onClick={() => setActiveSet(0)} active={activeSet===0}>
                    GoodCreate
                </HistoryButton>
                <HistoryButton onClick={() => setActiveSet(1)} active={activeSet===1}>
                    Japanese School
                </HistoryButton>
                <HistoryButton onClick={() => setActiveSet(2)} active={activeSet===2}>
                    Gameloft
                </HistoryButton>
                <HistoryButton onClick={() => setActiveSet(3)} active={activeSet===3}>
                    FPT Software
                </HistoryButton>
                <HistoryButton onClick={() => setActiveSet(4)} active={activeSet===4}>
                    University
                </HistoryButton>
            </HistoryNavigator>
            <ContentContainer active={activeSet===0}>
                <Title>Engineer Manager <sup>@</sup> <em>GoodCreate</em></Title>
                <Time>July 2020 - Present</Time>
                <Description>
                    Developed and shipped highly interactive web and mobile applications using <br/>
                    <ul>
                        <li><code>ReactNative</code></li>
                        <li><code>Flutter</code></li>
                        <li><code>Laravel</code></li>
                        <li><code>Wordpress</code></li>
                        <li><code>Kotlin</code></li>
                        <li><code>Swift</code></li>
                    </ul>
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===1}>
                <Title>Student <sup>@</sup> <em>Mizuno International Language School</em></Title>
                <Time>April 2019 - April 2020</Time>
                <Description>
                    I studied here for 1 year and was able to pass JLPT N3.
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===2}>
                <Title>Senior Game Programmer <sup>@</sup> <em>Gameloft Hanoi</em></Title>
                <Time>March 2014 - March 2016, June 2018 - November 2018</Time>
                <Description>
                    Developed and shipped high quality games using C++, OpenGL and in-house engine
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===3}>
                <Title>Software Developer <sup>@</sup> <em>FPT Software</em></Title>
                <Time>June 2016 - June 2018</Time>
                <Description>
                    Take part in the industry-standard software development process and delivered high quality C++ code.
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===4}>
                <Title>Bachelor Degree <sup>@</sup> <em>Hung Yen University of Technology and Education</em></Title>
                <Time>September 2010 - June 2014</Time>
                <Description>
                    I studied here for 4 year
                </Description>
            </ContentContainer>
        </HistoryContainer>
    </Container>
}