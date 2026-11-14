/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgPrimary: '#0B0E11',
        bgSecondary: '#161B22',
        borderDark: '#2B3139',
        binanceGreen: '#0ECB81',
        binanceRed: '#F6465D',
        textPrimary: '#F0F4F8',
        textSecondary: '#9CA3AF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
