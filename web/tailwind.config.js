/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // active le thème sombre via la classe `dark` (sur <html> ou <body>)
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // breakpoints supplémentaires utilisés dans ton code (3xl → 6xl)
      screens: {
        '3xl': '1600px',
        '4xl': '1800px',
        '5xl': '2000px',
        '6xl': '2200px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'), // pour line-clamp-2
  ],
}
