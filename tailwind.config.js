/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: 'var(--primary)',
                secondary: 'var(--secondary)',
                accent: 'var(--accent)',
                background: 'var(--background)',
                surface: 'var(--surface)',
                text: 'var(--text)',
            },
            keyframes: {
                'bounce-in': {
                    '0%': { opacity: '0', transform: 'scale(0.3)' },
                    '50%': { opacity: '1', transform: 'scale(1.05)' },
                    '70%': { transform: 'scale(0.9)' },
                    '100%': { transform: 'scale(1)' },
                }
            },
            animation: {
                'bounce-in': 'bounce-in 0.5s cubic-bezier(0.8, 0, 1, 1)',
            }
        },
    },
    plugins: [],
}
