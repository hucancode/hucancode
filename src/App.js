import React from "react";
import styled from "styled-components";
import tw from 'twin.macro';
import './App.css';
import Navbar from "./components/navBar";
import LandingSection from "./components/landingSection";
import FootNote from "./components/footNote";

const AppContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    w-full
    min-h-full
    bg-gray-300
    text-black
    dark:bg-gray-900
    dark:text-white
  `}
`;

export default function App() {
    return (
        <AppContainer>
            <Navbar />
            <LandingSection />
            <FootNote />
        </AppContainer>
    )
}