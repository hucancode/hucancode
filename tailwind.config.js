module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./widgets/**/*.{js,ts,jsx,tsx}",
        "./styles/**/*.css",
    ],
    darkMode: 'class',
    theme: {
      extend: {
        zIndex: {
          '-10': '-10',
          '10': '10',
        },
        skew: {
          '20': '20deg',
          '-20': '-20deg',
          '45': '45deg',
          '60': '60deg',
          '80': '80deg',
          '-80': '-80deg',
         },
         width: {
          '3/2': '150%',
          '5/2': '250%',
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
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
    },
    variants: {
      extend: {},
    },
    plugins: [],
  }
  