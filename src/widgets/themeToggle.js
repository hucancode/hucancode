import React from "react";
import anime from "animejs";

class ThemeToggleWidget extends React.Component {
  state = { isNightMode: true };

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
    const BUTTON_TRANSLATION = [0, 55.5];
    const BUTTON_SUN_OPACITY = [1.0, 0.0];
    const BG_TRANSLATION_DARK = [-40, 0];
    const BG_SCALE_DARK = [0.4, 1];

    this.controller
      .add({
        targets: this.sunMoon.current,
        translateX: BUTTON_TRANSLATION,
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
      if(this.state.isNightMode)
      {
        this.controller.play();
      }
  }

  componentDidUpdate() {
    let shouldReverse = this.state.isNightMode === this.controller.reversed;
    if (shouldReverse) {
      this.controller.reverse();
    }
    this.controller.play();
  }

  render() {
    return (
      <svg viewBox="0 0 100 45" height="60%" onClick={() =>
        this.setState({ isNightMode: !this.state.isNightMode })
      }>
        <defs>
          <rect id="background" x="0" y="0" width="90" height="40" rx="20"></rect>
          <clipPath id="clip">
            <use href="#background"></use>
          </clipPath>
          <linearGradient id="gradient-light" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#8bc8f2" offset="0"></stop>
            <stop stopColor="#fff" offset="1"></stop>
          </linearGradient>
          <filter id="blur-light">
            <feGaussianBlur stdDeviation="1"></feGaussianBlur>
          </filter>
          <pattern id="pattern-light" width="0.1" height="1" viewBox="0 0 10 45">
            <path fill="#40b5f8" d="M 0 0 a 6 6 0 0 0 10 0 v 45 h -10 z"></path>
          </pattern>
          <linearGradient id="gradient-dark" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#1F2241" offset="0"></stop>
            <stop stopColor="#7D59DF" offset="1"></stop>
          </linearGradient>
          <linearGradient id="gradient-mask" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#000" offset="0"></stop>
            <stop stopColor="#fff" offset="1"></stop>
          </linearGradient>
          <mask id="mask-dark">
            <use fill="url(#gradient-mask)" href="#background"></use>
          </mask>
          <radialGradient id="gradient-moon">
            <stop stopColor="#fdfdfd" offset="0.7"></stop>
            <stop stopColor="#e2e2e2" offset="1"></stop>
          </radialGradient>

          <radialGradient id="gradient-crater">
            <stop stopColor="#e0e0e0" offset="0"></stop>
            <stop stopColor="#d9d9d9" offset="1"></stop>
          </radialGradient>
          <pattern id="pattern-dark" width="0.2" height="1" viewBox="0 0 20 45">
            <path fill="#fff" d="M 2 5 l 1 1 l -1 1 l -1 -1 l 1 -1"></path>
            <path fill="#fff" d="M 10 16 l 1 1 l -1 1 l -1 -1 l 1 -1"></path>
            <path fill="#fff" d="M 16 27 l 1 1 l -1 1 l -1 -1 l 1 -1"></path>
            <path fill="#fff" d="M 10 38 l 1 1 l -1 1 l -1 -1 l 1 -1"></path>
          </pattern>
        </defs>

        <g transform="translate(5 2.5)">
          <g clipPath="url(#clip)">
            <g ref={this.darkBackground}>
              <use fill="url(#gradient-dark)" href="#background"></use>
              <rect transform="rotate(4)" fill="url(#pattern-dark)" width="100" height="45"></rect>
              <use mask="url(#mask-dark)" fill="url(#gradient-dark)" href="#background"></use>
            </g>
            <g ref={this.lightBackground}>
              <use fill="url(#gradient-light)" href="#background"></use>
              <rect fill="url(#pattern-light)" x="-5" y="27.5" width="100" height="45"></rect>
            </g>
          </g>
        </g>

        <g transform="translate(22.5 22.5)">
          <g ref={this.sunMoon}>
            <g ref={this.moon}>
              <circle fill="url(#gradient-moon)" cx="0" cy="0" r="20.5"></circle>
              <g transform="translate(-8 -7.5)">
                <ellipse transform="rotate(-30)" fill="url(#gradient-crater)" stroke="#d5d5d5" strokeWidth="0.2" cx="0" cy="0" rx="4" ry="3"></ellipse>
              </g>
              <g transform="translate(11 5)">
                <ellipse fill="url(#gradient-crater)" stroke="#d5d5d5" strokeWidth="0.2" cx="0" cy="0" rx="3.85" ry="4"></ellipse>
              </g>
              <g transform="translate(-6 12)">
                <ellipse transform="rotate(-10)" fill="url(#gradient-crater)" stroke="#d5d5d5" strokeWidth="0.2" cx="0" cy="0" rx="2" ry="1.75"></ellipse>
              </g>
            </g>
            <g ref={this.sun}>
              <circle fill="#FFD21F" cx="0" cy="0" r="21" filter="url(#blur-light)"></circle>
              <circle fill="#FFD21F" cx="0" cy="0" r="20.5"></circle>
            </g>
          </g>
        </g>
      </svg>);
  }
}

export default function ThemeToggle() {
  return <ThemeToggleWidget />;
}