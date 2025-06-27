/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [
    require('tailwindcss/defaultConfig'),
  ],
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "rainbow-wave": {
          "0%": {
            "background-position": "0% 50%",
          },
          "100%": {
            "background-position": "100% 50%",
          },
        },
      },
      animation: {
        "rainbow-wave": "rainbow-wave 4s linear infinite",
      },
    },
  },
  plugins: [],
}
