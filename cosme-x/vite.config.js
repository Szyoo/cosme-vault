import { defineConfig } from 'vite'
import { babel } from '@rollup/plugin-babel'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../public',
  },
  plugins: [
    vue(),
    babel({
      babelHelpers: 'bundled',
      exclude: /node_modules/,
      include: [/node_modules\/xtendui/],
    }),
  ],
})
