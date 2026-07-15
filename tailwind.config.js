/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#6430F7',
          'purple-light': '#8B5CF6',
          'purple-dark': '#4318CC',
          navy: '#1E293B',
          dark: '#0F172A',
        },
        app: {
          bg: '#080810',
          sidebar: '#0D0D18',
          panel: '#13131F',
          border: '#1F1F32',
          hover: '#1A1A2E',
        }
      },
      fontFamily: {
        montreal: ['"PP Neue Montreal"', 'sans-serif'],
        lausanne: ['"TWK Lausanne"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
