/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [
    require('tailwindcss/defaultConfig'),
    require('xtendui/tailwind.preset'),
  ],
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./node_modules/xtendui/src/*.mjs",
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
      xtendui: {
        animation: {
          "rainbow-wave": "rainbow-wave 4s linear infinite",
        },
      },
    },
  },
  plugins: [],
}
