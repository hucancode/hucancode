import React from "react";
import styled from "styled-components";
import tw from 'twin.macro';
import './App.css';
import Navbar from "./components/navBar";
import LandingSection from "./components/landingSection";

const AppContainer = styled.div`
  ${tw`
    flex
    flex-col
    items-center
    w-full
    text-3xl
    bg-gray-200
    text-black
    dark:bg-gray-600
    dark:text-white
  `}
`;

export default function App() {
  return (
    <AppContainer>
        <Navbar />
        <LandingSection />
    </AppContainer>
  )
}