import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';

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
        md:w-2/3
        xl:w-4/5
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
        text-xs
        text-left        
    `}
`;

const Description = styled.div`
    ${tw`
        w-full
        text-sm
        text-left
        mt-5
    `}
    & ul li {
        ${tw`
            relative
            pl-5
        `}
    }
    & ul li::before {
        content: "▸";
        ${tw`
            absolute
            left-0
        `}
    }
`;

// export default function ExperienceSection() {
//     return <Container id='experiences'>
//         <SectionTitle>Where I’ve worked</SectionTitle>
//         <UnderConstruction/>
//     </Container>
// }

export default function ExperienceSection() {
    var [activeSet, setActiveSet] = useState(0);
    return <Container id='experiences'>
        <SectionTitle>Where I’ve worked</SectionTitle>
        <HistoryContainer>
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
                    <ul>
                        <li>
                            Developed and shipped highly interactive mobile applications using <code>Swift</code> and <code>Kotlin</code>
                        </li>
                        <li>
                            Developed an app building system. Allow user to build their own mobile application without programming knowledge. Powered by <code>ReactNative</code>
                        </li>
                        <li>
                            In charge of research and development activity. Explore potential use of <code>Flutter</code> in future projects.
                        </li>
                        <li>Developed various E-commerce website using <code>Wordpress</code></li>
                    </ul>
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===1}>
                <Title>Student <sup>@</sup> <em>Mizuno International Language School</em></Title>
                <Time>April 2019 - April 2020</Time>
                <Description>
                <ul>
                    <li>
                        I took 2-years course, but I graduated early, only study there for 1 year.
                    </li>
                    <li>
                        I started with almost zero Japanese and was able to pass JLPT N3 before graduation. One year later I passed JLPT N2.
                    </li>
                    <li>
                        I finished all JLPT N2 programs offered by the school. I can communicate in Japanese at conversation level without difficulty.
                        Within my major field, I can communicate in Japanese at business level.
                    </li>
                </ul>
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===2}>
                <Title>Senior Game Programmer <sup>@</sup> <em>Gameloft Hanoi</em></Title>
                <Time>March 2014 - March 2016, June 2018 - November 2018</Time>
                <Description>
                    Updating...
                    {/* Developed and shipped high quality games using C++, OpenGL and in-house engine */}
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===3}>
                <Title>Senior Software Developer <sup>@</sup> <em>FPT Software</em></Title>
                <Time>June 2016 - June 2018</Time>
                <Description>
                    Updating...
                    {/* Take part in the industry-standard software development process and delivered high quality C++ code. */}
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===4}>
                <Title>Bachelor Degree <sup>@</sup> <em>Hung Yen University of Technology and Education</em></Title>
                <Time>September 2010 - June 2014</Time>
                <Description>
                    <ul>
                        <li>
                            My major was <code>Software Engineering</code>. Over the course of 4 years, I was well trained with <code>C/C++, C#</code>. 
                            I got perfect mark (10/10) in Computer Programming, almost perfect (9/10) in Data Structure and Algorithm. All major subject with Very Good grade (8+/10).
                        </li>
                        <li>
                            I aced an university programming contest. Both as an individual and as a team.
                        </li>
                        <li>
                            I represented my university taking part in National Olympiad of Informatics. I got an incentive prize.
                        </li>
                        <li>
                            My team represented my university taking part in ACM/ICPC.
                        </li>
                    </ul>
                </Description>
            </ContentContainer>
        </HistoryContainer>
    </Container>
}