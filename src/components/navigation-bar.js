import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import tw from "twin.macro";
import HamburgerButton from "../widgets/hamburgerButton";
import ThemeToggle from "../widgets/themeToggle";
import Logo from "../widgets/logo";
import { useTranslation } from 'next-i18next';

const Container = styled.nav`
    ${tw`
        container
        box-border
        w-full
        h-16
        flex
        flex-row
        items-center
        justify-between
    `}
`;

const NavItems = styled.ul`
    ${tw`
        flex flex-col md:flex-row
        z-40
        list-none
        fixed md:static 
        left-0
        top-0
        ease-out
        duration-200
        px-8
        py-4
        transform
        h-screen
        md:h-full
        dark:md:h-full
        bg-gray-100
        dark:bg-black
        md:bg-transparent
        dark:md:bg-transparent
    `}
    ${props => props.open ? `transform: translateX(0);` : `transform: translateX(-100%);`}
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
`;

const LogoContainer = styled.div`
    ${tw`
        w-12
        h-12
        bg-transparent
        select-none
    `}
`;

const ThemeContainer = styled.div`
    ${tw`
        flex
        items-center
        border-none
        outline-none
        cursor-pointer
        w-16
        h-12
        bg-transparent
        select-none
    `}
`;
const HamburgerContainer = styled.button`
    ${tw`
        relative
        block
        md:hidden
        border-none
        outline-none
        cursor-pointer
        w-8
        h-12
        mr-8
        select-none
    `}
`;

export default function Navbar() {
    let isTouchDevice = false;
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef(null);
    const { t } = useTranslation();

    useEffect(() => {
        isTouchDevice = (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
        const closeDrawer = event => {
            if (drawerRef.current && drawerRef.current.contains(event.target)) {
                return;
            }
            if (isDrawerOpen) {
                setDrawerOpen(false);
            }
        };
        document.addEventListener("mousedown", closeDrawer);
        return () => document.removeEventListener("mousedown", closeDrawer);
    }, [isDrawerOpen]);

    const navItems = <NavItems ref={drawerRef} open={isDrawerOpen || !isTouchDevice}>
        <NavItem>
            <a href='#skill'>{t('nav.skill')}</a>
        </NavItem>
        <NavItem>
            <a href='#experiences'>{t('nav.exp')}</a>
        </NavItem>
        <NavItem>
            <a href='#challenge'>{t('nav.works')}</a>
        </NavItem>
        <NavItem>
            <a href='#contact'>{t('nav.contact')}</a>
        </NavItem>
    </NavItems>

    return <Container>
        <HamburgerContainer onClick={() => setDrawerOpen(true)}>
            <HamburgerButton />
        </HamburgerContainer>
        <LogoContainer>
            <Logo />
        </LogoContainer>
        {navItems}
        <ThemeContainer>
            <ThemeToggle />
        </ThemeContainer>
    </Container>
}