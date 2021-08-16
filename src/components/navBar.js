import React from "react";
import styled from "styled-components";
import tw from "twin.macro";
import ThemeToggle from "../widgets/themeToggle";

const Container = styled.div`
    height: 60px;
    ${tw`
        box-border
        w-full
        max-w-screen-2xl
        flex
        flex-row
        items-center
        lg:pl-12
        lg:pr-12
        pl-3
        pr-3
        justify-end
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
        text-gray-300
        font-medium
        mr-3
        md:mr-5
        cursor-pointer
        transition
        duration-300
        ease-in-out
        hover:text-gray-500
    `}
`;

export default function Navbar() {
    const navItems = <NavItems>
        <NavItem>
            <a href='#'>Game Development</a>
        </NavItem>
        <NavItem>
            <a href='#'>Mobile Development</a>
        </NavItem>
        <NavItem>
            <a href='#'>Contact</a>
        </NavItem>
    </NavItems>
    return <Container>
        {navItems}
        <ThemeToggle />
    </Container>
}