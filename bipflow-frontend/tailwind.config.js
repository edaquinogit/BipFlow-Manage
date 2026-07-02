/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Brand tokens (bip-black/soft/line/rose/blush/muted) and design
      // tokens (semantic colors, micro text sizes, card radius/shadow)
      // live in src/assets/main.css via the Tailwind v4 @theme directive.
    },
  },
  plugins: [],
}
