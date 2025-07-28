/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'text-slide-4': 'text-slide-4 7s cubic-bezier(0.83, 0, 0.17, 1) infinite',
        'up-loop': 'up-loop 1s linear infinite',
        'down-loop': 'down-loop 1s linear infinite',
      },
      keyframes: {
        'text-slide-4': {
          '0%, 20%': {
            transform: 'translateY(0%)',
          },
          '25%, 45%': {
            transform: 'translateY(-20%)',
          },
          '50%, 70%': {
            transform: 'translateY(-40%)',
          },
          '75%, 95%': {
            transform: 'translateY(-60%)',
          },
          '100%': {
            transform: 'translateY(-80%)',
          },
        },
        'up-loop': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(-10px)', opacity: '0' },
        },
        'down-loop': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(10px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
