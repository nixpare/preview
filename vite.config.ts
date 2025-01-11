import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src',
  build: {
    target: 'es2020',
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [
        resolve(__dirname, 'src/index.html'),
        resolve(__dirname, 'src/login.html')
      ]
    },
  },
  server: {
    port: 3000,
  },
})
