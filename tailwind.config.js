/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0b162a',
        surface: '#0f1b32',
        card: '#111e3a',
        accent: '#0b5fff',
        accentSoft: '#3b82f6',
        slate: {
          900: '#0f172a',
          950: '#0b1224',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        glow: '0 10px 50px rgba(11,95,255,0.35)',
      },
    },
  },
  plugins: [],
};
