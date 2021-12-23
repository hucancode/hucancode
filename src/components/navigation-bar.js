import React, { useState, useEffect, useRef } from "react";
import HamburgerButton from "../widgets/hamburgerButton";
import ThemeToggle from "../widgets/themeToggle";
import Logo from "../widgets/logo";
import { useTranslation } from 'next-i18next';
import Link from "next/link";

function Container(props) {
    return <nav>
        {props.children}
    </nav>
}

function LogoContainer(props) {
    return <div className="w-12
        h-12
        bg-transparent
        select-none
        cursor-pointer">
        {props.children}
    </div>
}

function ThemeContainer(props) {
    return <div className="flex items-center
        border-none
        outline-none
        cursor-pointer
        w-16 h-12
        bg-transparent
        select-none">
        {props.children}
    </div>
}

function HamburgerContainer(props) {
    return <button className="relative
        block
        md:hidden
        border-none
        outline-none
        cursor-pointer
        w-8 h-12
        mr-8
        select-none">
        {props.children}
    </button>
}

export default function Navbar() {
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const [isMdOrUp, setIsMdOrUp] = useState(false);
    const drawerRef = useRef(null);
    const { t } = useTranslation();

    useEffect(() => {
        setIsMdOrUp(window.matchMedia("(min-width: 768px)").matches);
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

    const navItems = <ul ref={drawerRef} open={isDrawerOpen || isMdOrUp}>
        <li>
            <Link href='/#skill'>{t('nav.skill')}</Link>
        </li>
        <li>
            <Link href='/#experiences'>{t('nav.exp')}</Link>
        </li>
        <li>
            <Link href='/#challenge'>{t('nav.works')}</Link>
        </li>
        <li>
            <Link href='/#contact'>{t('nav.contact')}</Link>
        </li>
    </ul>

    return <Container>
        <HamburgerContainer onClick={() => setDrawerOpen(true)}>
            <HamburgerButton />
        </HamburgerContainer>
        <Link href='/' passHref>
            <LogoContainer>
                <Logo />
            </LogoContainer>
        </Link>
        {navItems}
        <ThemeContainer>
            <ThemeToggle />
        </ThemeContainer>
    </Container>
}