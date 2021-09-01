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
        font-bold
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
        font-light
        text-left
        mt-5
    `}
    font-family: "Noto Sans JP";
    & em {
        ${tw`
            text-purple-900
            dark:text-yellow-100
        `}
    }
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
        <SectionTitle>Where have I been</SectionTitle>
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
                <Title>Engineering Manager <sup>@</sup> <em>GoodCreate</em></Title>
                <Time>July 2020 - Present</Time>
                <Description>
                    <ul>
                        <li>
                            The position title may be confusing. I am in charge of software engineering department in GoodCreate.
                            I discuss the requirement, provide technical advices, propose high level solutions.
                        </li>
                        <li>
                            I developed highly interactive mobile applications using <code>Swift</code> and <code>Kotlin</code>
                        </li>
                        <li>
                            I am in charge of an <a href="https://at-creator.net/">app building system</a>. Allow user to build their own mobile application without programming knowledge. Powered by <code>ReactNative</code>
                        </li>
                        <li>
                            I do research and development activity. Explore potential use of <code>Flutter</code> in future projects.
                        </li>
                        <li>I developed an <a href="https://www.ramen-ichidai.shop/">E-commerce website</a> using <code>Wordpress</code> and <code>Welcart</code></li>
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
                        I started with almost zero Japanese and was able to pass <em>JLPT N3</em> before graduation. Two years later I passed <em>JLPT N2</em>.
                    </li>
                    <li>
                        I can communicate in Japanese at business level. 
                        I am able to discuss technical topic in Japanese with minimal difficulty. 
                    </li>
                    <li>
                        I can act as English-Japanese-Vietnamese interpreter at conversational level.<br/>
                        I can interpret business Japanese to some degree.
                    </li>
                </ul>
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===2}>
                <Title>Senior Game Programmer <sup>@</sup> <em>Gameloft Hanoi</em></Title>
                <Time>March 2014 - March 2016, June 2018 - November 2018</Time>
                <Description>
                    <ul>
                        <li>
                            I have taken part in Gameloft AI Contest 2013, I finished at <em>Quater Final (rank #4~8)</em>.
                            I soon joined Gameloft later on March 2014.
                        </li>
                        <li>
                            Deeply immersed in international environment, my English ability improved significantly. 
                            Thanks to that, earlier in 2021, I took the TOEIC English test and achieved <em>945/990 points</em>.
                        </li>
                        <li>
                            Started out as a C++ Game Programmer, I developed my interest in Computer Graphics.
                            I am in charge of gameplay programming and graphics optimization for games. 
                            I am well trained in OpenGL, shader programming and various graphics debugging tools.
                        </li>
                        <li>
                            I was in charge of gameplay programming and graphics optimization in the following games (all based on C++ and OpenGL):
                            <ul>
                                <li>
                                    Sharkdash, built using 2D in-house engine.
                                </li>
                                <li>
                                    Ice Age Adventures, built using in-house 3D engine. 
                                </li>
                                <li>
                                    Brothers in Arms 3, built using Irrlicht-based in-house engine (3D).
                                </li>
                                <li>
                                    Order and Chaos 2, 3D MMORPG, built using in-house engine.
                                </li>
                                <li>
                                    Disney Magic Kingdom, built using Irrlicht-based in-house engine (3D).
                                </li>
                            </ul>
                        </li>
                    </ul>
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===3}>
                <Title>Senior Software Developer <sup>@</sup> <em>FPT Software</em></Title>
                <Time>June 2016 - June 2018</Time>
                <Description>
                    <ul>
                        <li>
                            I joined FPT Software on June 2016 and lead a team of 5 challenging a C++ project with <em>2 millions lines of code</em>.
                            That was a migration project, bringing an old 32-bit based system to 64-bit. 
                            I was in charge of building custom developement tools (CLI) for the team. 
                            I did review other member's code to ensure source code quality.
                        </li>
                        <li>
                            I developed application for an entertainment system running on Automobile devices (in parnership with LG).
                            That was media playing application, built with Qt. 
                            I am in charge of feature implementation and <em>overall performance optimization</em>.
                        </li>
                        <li>
                            Over the course of 2 years at FPT Software, I have received various training on Project Management. 
                            I learned how to manage a small team and was pretty successful at it.
                        </li>
                        <li>
                            I was received honorable mention as <em>Best Rookie of The Year 2016</em>.
                        </li>
                    </ul>
                </Description>
            </ContentContainer>
            <ContentContainer active={activeSet===4}>
                <Title>Bachelor Degree <sup>@</sup> <em>Hung Yen University of Technology and Education</em></Title>
                <Time>September 2010 - June 2014</Time>
                <Description>
                    <ul>
                        <li>
                            My major was <code>Software Engineering</code>. Over the course of 4 years, I was well trained with <code>C/C++, C#</code>. 
                            I got perfect mark <em>(10/10)</em> in Computer Programming, Semester Project #4.
                            I have most major subjects above A grade <em>(8.0+/10)</em>, with A+ in Graduation Project <em>(9.2/10)</em>.
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