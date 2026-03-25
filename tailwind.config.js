/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        /** Ink: navigation, headings, dark surfaces */
        primary: {
          DEFAULT: '#0f172a',
          light: '#334155',
          pale: '#cbd5e1',
          muted: '#f1f5f9',
        },
        /**
         * Brand teal — primary actions, active nav, links (aligned with Supervise360 references).
         */
        brand: {
          DEFAULT: '#0f766e',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        /** Accent: keep in sync with brand for existing `accent` utilities */
        accent: {
          DEFAULT: '#0d9488',
          hover: '#0f766e',
          soft: '#ccfbf1',
          muted: '#5eead4',
        },
        /** App canvas behind cards */
        canvas: {
          DEFAULT: '#f4f6f8',
          subtle: '#f8fafc',
        },
      },
    },
  },
  plugins: [],
};
