/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                marine: {
                    DEFAULT: '#0047AB',
                    dark: '#003087',
                    light: '#1B65D5'
                },
                water: {
                    blank: '#F8FAFC',
                    light: '#E0F2FE',
                    deep: '#0369A1'
                }
            },
        },
    },
    plugins: [],
}
