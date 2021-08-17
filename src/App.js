import React from "react";
import styled from "styled-components";
import tw from 'twin.macro';
import './App.css';
import Navbar from "./components/navBar";
import SaborScene from "./components/saborScene";

const AppContainer = styled.div`
  ${tw`
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
        <SaborScene />
    </AppContainer>
  )
}