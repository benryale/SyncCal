import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:8000',
        secure:false, // tells vite to trust djangos self signed cert
        changeOrigin: true,
      },
      '/ws': {
        target: 'wss://127.0.0.1:8000',
        ws: true,
        secure: false,
        changeOrigin: true,
      },
    },
  },
})
