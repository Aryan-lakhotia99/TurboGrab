/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        genesis: {
          primary: '#6366F1',
          'primary-hover': '#4F46E5',
          secondary: '#20970B',
          'text-primary': '#0A0A0A',
          'text-secondary': '#6B6B6B',
          background: '#FAFAFA',
          surface: '#FFFFFF',
          border: '#E8E8EC',
          muted: '#F4F4F6',
          card: '#FFFFFF',
          accent: '#4F46E5',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        display: ['"General Sans"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'tag': '4px',
        'btn': '6px',
        'panel': '8px',
        'card': '12px',
        'pill': '9999px',
      },
      boxShadow: {
        'genesis-flat': '0 0 0 1px #E8E8EC',
        'genesis-hover': '0 8px 30px rgba(0, 0, 0, 0.08), 0 0 0 1px #E8E8EC',
        'genesis-modal': '0 20px 50px rgba(0, 0, 0, 0.12), 0 0 0 1px #E8E8EC',
      },
      letterSpacing: {
        'display': '-0.03em',
      }
    },
  },
  plugins: [],
}
