/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          light: '#52B788',
          dark: '#1B4332',
        },
        accent: {
          DEFAULT: '#F4A261',
          dark: '#E76F51',
        },
        surface: '#FFFFFF',
        background: '#FAFAF8',
        border: '#E8E8E4',
        badge: '#FFF3E0',
        success: '#40916C',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
