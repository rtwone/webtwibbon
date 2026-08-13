/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: '#2563EB',
                secondary: '#38BDF8',
                bg: '#F8FAFC',
                card: '#FFFFFF',
                ink: '#111827',
                muted: '#64748B',
                border: '#E2E8F0',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                '2xl': '16px',
                '3xl': '24px',
                '4xl': '28px',
            },
        },
    },
    plugins: [],
};
