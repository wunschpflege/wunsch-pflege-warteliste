import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eefbf9', 100: '#d3f4ef', 200: '#abe9e1', 300: '#74d7cd',
          400: '#3cbcb2', 500: '#239f97', 600: '#1a807b', 700: '#196663',
          800: '#195250', 900: '#194543', 950: '#082827',
        },
      },
    },
  },
  plugins: [],
};

export default config;
