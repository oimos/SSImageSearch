/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#09090B',
          1: '#111113',
          2: '#1A1A1D',
          3: '#222225',
          4: '#2B2B2F'
        },
        border: {
          DEFAULT: '#27272A',
          subtle: '#1E1E21',
          accent: '#3F3F46'
        },
        accent: {
          DEFAULT: '#6366F1',
          hover: '#818CF8',
          muted: 'rgba(99, 102, 241, 0.12)',
          text: '#A5B4FC'
        },
        txt: {
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          tertiary: '#71717A',
          muted: '#52525B'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"',
          '"Hiragino Sans"', '"Noto Sans JP"', 'sans-serif'
        ]
      },
      fontSize: {
        '2xs': ['0.6875rem', '1rem']
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        skeleton: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' }
        }
      }
    }
  },
  plugins: []
}
