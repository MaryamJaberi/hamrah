import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6C5CE7', 'primary-soft': '#EEEBFF', accent: '#00B894', 'accent-soft': '#E1F7F0',
        warn: '#E5484D', 'warn-soft': '#FFECEC', ink: '#17172A', muted: '#6B6B82', line: '#E9E9F2',
      },
      fontFamily: { sans: ['Vazirmatn', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
