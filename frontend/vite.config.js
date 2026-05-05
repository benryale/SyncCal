import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

// caddy is in front handling https now, so we point hmr at port 443
// so live reload still works through it.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      clientPort: 443,
    },
  },
})
