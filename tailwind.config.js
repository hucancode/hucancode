module.exports = {
  content: [
    "./src/pages/**/*.js",
    "./src/components/**/*.js",
    "./src/widgets/**/*.js",
    "./src/styles/**/*.css",
  ],
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
      backgroundSize: {
        "half-width": "50% 100%",
      },
      backgroundImage: {
        rainbow:
          "linear-gradient(115deg,#4fcf70,#fad648,#a767e5,#12bcfe,#44ce7b)",
        "opaque-radial": "radial-gradient(closest-side,#ffffff20,#00000032)",
      },
      animation: {
        "waving-hand": "waving-hand 2.5s infinite",
        "move-left": "move-left 1.5s linear infinite",
        "language-guide": "language-guide 5s linear alternate infinite",
      },
      keyframes: {
        "waving-hand": {
          "0%": { transform: "rotate(0.0deg)" },
          "10%": { transform: "rotate(20deg)" },
          "20%": { transform: "rotate(-10deg)" },
          "30%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-10deg)" },
          "50%": { transform: "rotate(0.0deg)" },
        },
        "move-left": {
          to: { transform: "translateX(-50%)" },
        },
        "language-guide": {
          "0%": { opacity: "1", content: '"Tap here to change language"' },
          "30%": { opacity: "1", content: '"Tap here to change language"' },
          "50%": { opacity: "0", content: '"Tap here to change language"' },
          "51%": { opacity: "0", content: '"言語変更には、ここにタップ"' },
          "70%": { opacity: "1", content: '"言語変更には、ここにタップ"' },
          "100%": { opacity: "1", content: '"言語変更には、ここにタップ"' },
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
  variants: {
    extend: {},
  },
  plugins: [],
};
