module.exports = {
    content: [
        "./src/pages/**/*.js",
        "./src/components/**/*.js",
        "./src/widgets/**/*.js",
        "./src/styles/**/*.css",
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
            animation: {
                'waving-hand': 'waving-hand 2.5s infinite',
                'move-left': 'move-left 1.5s linear infinite',
                'language-guide': 'language-guide 5s linear alternate infinite',
            },
            keyframes: {
                'waving-hand': {
                    '0%': { transform: 'rotate(0.0deg)' },
                    '10%': { transform: 'rotate(20deg)' },
                    '20%': { transform: 'rotate(-10deg)' },
                    '30%': { transform: 'rotate(10deg)' },
                    '40%': { transform: 'rotate(-10deg)' },
                    '50%': { transform: 'rotate(0.0deg)'},
                },
                'move-left': {
                    'to' : { transform: 'translateX(-50%)' }
                },
                'language-guide': {
                    '0%': { content: "Tap here to change language"},
                    '30%': { opacity: '1'},
                    '50%': { opacity: '0'},
                    '70%': {opacity: '1'},
                    '100%': {content: "言語変更には、ここにタップ"},
                }
            }
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
