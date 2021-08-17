import React from "react";
import {useMediaQuery} from 'react-responsive';
import styled from "styled-components";
import tw from "twin.macro";
import { slide as Menu } from 'react-burger-menu';
import ThemeToggle from "../widgets/themeToggle";
import {SCREENS} from "./screens"

const Container = styled.div`
    ${tw`
        container
        box-border
        w-full
        h-14
        max-w-screen-2xl
        flex
        flex-row
        items-center
        lg:pl-12
        lg:pr-12
        pl-3
        pr-3
        justify-between
    `}
`;

const NavItems = styled.ul`
    ${tw`
        flex
        list-none
    `};
`;

const NavItem = styled.li`
    ${tw`
        text-xl
        dark:text-gray-300
        text-gray-900
        font-medium
        mr-3
        md:mr-5
        cursor-pointer
        transition
        duration-300
        ease-in-out
        hover:text-gray-500
        dark:hover:text-gray-100
    `}
    ${(props) => `
        ${props.mobile && tw`
            text-white
            mb-3
            focus:text-gray-300
            hover:text-gray-300
        `}
    `}
`;

function buildMenuStyle(isDarkMode)
{
    return {
        bmBurgerButton: {
            position: "relative",
            width: "20px",
            height: "20px",
        },
        bmBurgerBars: {
            background: "#000000",
        },
        bmBurgerBarsHover: {
            background: "#222222",
        },
        bmCrossButton: {
            height: "24px",
            width: "24px",
        },
        bmCross: {
            background: "#cccccc",
        },
        bmMenuWrap: {
            position: "fixed",
            width: "60%",
            height: "100%",
            top: "0px",
            left: "0px",
        },
        bmMenu: {
            background: "#4b5563",
            fontSize: "1.15em",
        },
        bmItemList: {
            padding: "1em",
        },
        bmOverlay: {
            background: "rgba(0, 0, 0, 0.3)",
            top: "0px",
            left: "0px",
        },
    }
}

export default function Navbar() {
    console.log('nav');
    const isMobile = useMediaQuery( {maxWidth: SCREENS.sm});
    let isDarkMode = document.querySelector('html').classList.contains("dark");
    const menuStyle = buildMenuStyle(isDarkMode);
    const navItems = <NavItems mobile={isMobile}>
        <NavItem mobile={isMobile}>
            <a href='#'>Game</a>
        </NavItem>
        <NavItem mobile={isMobile}>
            <a href='#'>Mobile</a>
        </NavItem>
        <NavItem mobile={isMobile}>
            <a href='#'>Contact</a>
        </NavItem>
    </NavItems>
    const menuNav = <Menu left styles={menuStyle}>
        {navItems}
    </Menu>
    return <Container>
        {isMobile?menuNav:navItems}
        <ThemeToggle/>
    </Container>
}