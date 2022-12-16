const config = {
  content: ["./src/**/*.{html,js,svelte,ts,css}"],
  darkMode: "class",
  theme: {
    extend: {
      width: {
        "3/2": "150%",
        "2/1": "200%",
        "4/2": "200%",
        double: "200%",
        "5/2": "250%",
      },
      fontFamily: {
        "logo-cursive": ['"Great Vibes"', "cursive"],
      },
      backgroundSize: {
        "half-width": "50% 100%",
        "double-width": "200% 100%",
      },
      backgroundImage: {
        rainbow:
          "linear-gradient(115deg,#4fcf70,#fad648,#a767e5,#12bcfe,#44ce7b)",
        rainbow2:
          "linear-gradient(141.27deg,#ff904e 0%,#ff5982 20%,#ec68f4 40%,#79e2ff 80%)",
        "opaque-radial": "radial-gradient(closest-side,#ffffff20,#00000032)",
      },
      animation: {
        "waving-hand": "waving-hand 2.5s infinite",
        "move-left": "move-left 1.5s linear infinite",
        "bg-pingpong": "bg-pingpong 5s ease infinite alternate",
        marquee: "move-left-full 60s infinite linear",
        "marquee-reverse": "move-right-full 60s infinite linear",
      },
      keyframes: {
        "bg-pingpong": {
          to: { "background-position-x": "50%" },
        },
        "waving-hand": {
          "0%": { transform: "rotate(0.0deg)" },
          "10%": { transform: "rotate(20deg)" },
          "20%": { transform: "rotate(-10deg)" },
          "30%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-10deg)" },
          "50%": { transform: "rotate(0.0deg)" },
        },
        "move-right-full": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0%)" },
        },
        "move-left-full": {
          to: { transform: "translateX(-100%)" },
        },
        "move-left": {
          to: { transform: "translateX(-50%)" },
        },
      },
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    container: {
      padding: {
        DEFAULT: "1rem",
        sm: "2rem",
        lg: "4rem",
        xl: "5rem",
        "2xl": "6rem",
      },
    },
  },
  plugins: [],
};

module.exports = config;
