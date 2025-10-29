/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--background-color)',
        },
        btn: {
          color: 'var(--btn-color)',
          activeColor: 'var(--btn-active-color)',
          hoverBorder: 'var(--btn-hover-border)',
        },
      },
    },
  },
  plugins: [],
}
