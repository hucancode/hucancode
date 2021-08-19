import React from "react";
import anime from "animejs";

export default class ThemeToggle extends React.Component {
    constructor(props) {
        super(props);
    }

    state = { isDarkMode: true };

    sunMoon = React.createRef();
    sun = React.createRef();
    moon = React.createRef();
    darkBackground = React.createRef();
    lightBackground = React.createRef();
    controller = anime.timeline({ autoplay: false });

    componentDidMount() {
        const ANIMATION_TIME = 700;
        const BG_ANIMATION_DELAY = 300;
        const BUTTON_ROTATION = [0, 100];
        const BUTTON_TRANSLATION_X = [22.5, 78];
        const BUTTON_TRANSLATION_Y = [22.5, 22.5];
        const BUTTON_SUN_OPACITY = [1.0, 0.0];
        const BG_TRANSLATION_DARK = [-40, 0];
        const BG_SCALE_DARK = [0.4, 1];

        this.controller
            .add({
                targets: this.sunMoon.current,
                translateX: BUTTON_TRANSLATION_X,
                translateY: BUTTON_TRANSLATION_Y,
                duration: ANIMATION_TIME,
                easing: "easeInOutExpo"
            }, 0)
            .add({
                targets: this.moon.current,
                rotate: BUTTON_ROTATION,
                duration: ANIMATION_TIME,
                easing: "easeInOutExpo"
            }, 0)
            .add({
                targets: this.sun.current,
                opacity: BUTTON_SUN_OPACITY,
                duration: ANIMATION_TIME,
                easing: "easeInOutExpo"
            }, 0)
            .add({
                targets: this.darkBackground.current,
                translateY: BG_TRANSLATION_DARK,
                scaleY: BG_SCALE_DARK,
                duration: ANIMATION_TIME,
                easing: "easeInOutExpo"
            }, BG_ANIMATION_DELAY)
            .add({
                targets: this.lightBackground.current,
                opacity: BUTTON_SUN_OPACITY,
                duration: ANIMATION_TIME,
                easing: "easeInOutExpo"
            }, 0);
        if (this.state.isDarkMode) {
            this.controller.play();
            document.querySelector('html').classList.add('dark');
        }
    }

    componentDidUpdate() {
        let shouldReverse = this.state.isDarkMode === this.controller.reversed;
        let shouldPlay = shouldReverse || !this.controller.finished;
        if (shouldReverse) {
            this.controller.reverse();
        }
        if (shouldPlay) {
            this.controller.play();
        }
        let htmlClasses = document.querySelector('html').classList;
        if (this.state.isDarkMode) {
            htmlClasses.add('dark');
        } else {
            htmlClasses.remove('dark');
        }
    }

    render() {
        const switchNightMode = () => {
            this.setState({ isDarkMode: !this.state.isDarkMode });
        };
        return (
            <svg viewBox="0 0 100 45" height="100%" onClick={switchNightMode}>
                <defs>
                    <rect id="background" x="0" y="0" width="90" height="40" rx="20" />
                    <clipPath id="clip">
                        <use href="#background" />
                    </clipPath>
                    <linearGradient id="gradient-light" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="#8bc8f2" offset="0" />
                        <stop stopColor="#fff" offset="1" />
                    </linearGradient>
                    <filter id="blur-light">
                        <feGaussianBlur stdDeviation="1" />
                    </filter>
                    <pattern id="pattern-light" width="0.1" height="1" viewBox="0 0 10 45">
                        <path fill="#40b5f8" d="M 0 0 a 6 6 0 0 0 10 0 v 45 h -10 z" />
                    </pattern>
                    <linearGradient id="gradient-dark" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="#1F2241" offset="0" />
                        <stop stopColor="#7D59DF" offset="1" />
                    </linearGradient>
                    <linearGradient id="gradient-mask" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="#000" offset="0" />
                        <stop stopColor="#fff" offset="1" />
                    </linearGradient>
                    <radialGradient id="gradient-moon">
                        <stop stopColor="#fdfdfd" offset="0.7" />
                        <stop stopColor="#e2e2e2" offset="1" />
                    </radialGradient>

                    <radialGradient id="gradient-crater">
                        <stop stopColor="#e0e0e0" offset="0" />
                        <stop stopColor="#d9d9d9" offset="1" />
                    </radialGradient>
                    <pattern id="pattern-dark" width="0.2" height="1" viewBox="0 0 20 45">
                        <path fill="#fff" d="M 2 5 l 1 1 l -1 1 l -1 -1 l 1 -1" />
                        <path fill="#fff" d="M 10 16 l 1 1 l -1 1 l -1 -1 l 1 -1" />
                        <path fill="#fff" d="M 16 27 l 1 1 l -1 1 l -1 -1 l 1 -1" />
                        <path fill="#fff" d="M 10 38 l 1 1 l -1 1 l -1 -1 l 1 -1" />
                    </pattern>
                </defs>

                <g transform="translate(5 2.5)" clipPath="url(#clip)">
                    <g ref={this.darkBackground}>
                        <use fill="url(#gradient-dark)" href="#background" />
                        <rect transform="rotate(4)" fill="url(#pattern-dark)" width="100" height="45" />
                    </g>
                    <g ref={this.lightBackground}>
                        <use fill="url(#gradient-light)" href="#background" />
                        <rect fill="url(#pattern-light)" x="-5" y="27.5" width="100" height="45" />
                    </g>
                </g>
                <g transform="translate(22.5 22.5)" ref={this.sunMoon}>
                    <g ref={this.moon}>
                        <circle fill="url(#gradient-moon)" cx="0" cy="0" r="20.5" />
                        <ellipse transform="translate(-8 -7.5) rotate(-30)" fill="url(#gradient-crater)" stroke="#d5d5d5" strokeWidth="0.2" cx="0" cy="0" rx="4" ry="3" />
                        <ellipse transform="translate(11 5)" fill="url(#gradient-crater)" stroke="#d5d5d5" strokeWidth="0.2" cx="0" cy="0" rx="3.85" ry="4" />
                        <ellipse transform="translate(-6 12) rotate(-10)" fill="url(#gradient-crater)" stroke="#d5d5d5" strokeWidth="0.2" cx="0" cy="0" rx="2" ry="1.75" />
                    </g>
                    <g ref={this.sun}>
                        <circle fill="#FFD21F" cx="0" cy="0" r="21" filter="url(#blur-light)" />
                        <circle fill="#FFD21F" cx="0" cy="0" r="20.5" />
                    </g>
                </g>
            </svg>);
    }
}