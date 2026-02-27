/** @type {import('tailwindcss').Config} */

function rgb(varName) {
  return `rgb(var(${varName}) / <alpha-value>)`
}

module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          0: rgb('--surface-0'),
          1: rgb('--surface-1'),
          2: rgb('--surface-2'),
          3: rgb('--surface-3'),
          4: rgb('--surface-4')
        },
        border: {
          DEFAULT: rgb('--border'),
          subtle: rgb('--border-subtle'),
          accent: rgb('--border-accent')
        },
        accent: {
          DEFAULT: rgb('--accent'),
          hover: rgb('--accent-hover'),
          muted: 'var(--accent-muted)',
          text: rgb('--accent-text')
        },
        txt: {
          primary: rgb('--txt-primary'),
          secondary: rgb('--txt-secondary'),
          tertiary: rgb('--txt-tertiary'),
          muted: rgb('--txt-muted')
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
