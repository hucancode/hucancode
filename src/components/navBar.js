import React, {useState, useEffect, useRef} from "react";
import { useMediaQuery } from 'react-responsive';
import styled from "styled-components";
import tw from "twin.macro";
import HamburgerButton from "../widgets/hamburgerButton";
import ThemeToggle from "../widgets/themeToggle";
import Logo from "../widgets/logo";
import { SCREENS } from './screens';

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
        flex-col
        z-40
        list-none
        fixed
        md:static
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
        bg-gray-300
        dark:bg-gray-900
        md:flex-row
        md:bg-transparent
        dark:md:bg-transparent
    `}
    ${props => props.open ? `transform: translateX(0);`: `transform: translateX(-100%);`}
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

export default function Navbar() {
    const isMobile = useMediaQuery( {maxWidth: SCREENS.md});
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef(null);

    useEffect(() => {
        const closeDrawer = event => {
            if (drawerRef.current && drawerRef.current.contains(event.target)) {
                return;
            }
            if(isDrawerOpen) {
                setDrawerOpen(false);
            }
        };
        document.addEventListener("mousedown", closeDrawer);
        return () => document.removeEventListener("mousedown", closeDrawer);
    }, [isDrawerOpen, isMobile]);

    const navItems = <NavItems ref={drawerRef} open={isDrawerOpen || !isMobile}>
        <NavItem>
            <a href='#'>Game</a>
        </NavItem>
        <NavItem>
            <a href='#'>Mobile</a>
        </NavItem>
        <NavItem>
            <a href='#'>Contact</a>
        </NavItem>
    </NavItems>
    return <Container>
        <HamburgerButton onClick={() => setDrawerOpen(true)} />
        <Logo/>
        {navItems}
        <ThemeToggle/>
    </Container>
}