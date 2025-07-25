import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import MotionResolver from 'motion-v/resolver'
import path from 'path'

export default defineConfig({
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../public',
  },
  plugins: [
    vue(),
    tailwindcss(),
    Components({
      dts: true,
      resolvers: [
        MotionResolver()
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
