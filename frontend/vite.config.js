import { defineConfig } from 'vite'
import { resolve } from 'path'

// Portas configuráveis por variável de ambiente (padrões originais preservados).
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5173
const API_TARGET = process.env.API_TARGET || 'http://localhost:3001'

export default defineConfig({
  server: {
    host: true,
    port: FRONTEND_PORT,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: true,
    port: FRONTEND_PORT,
    allowedHosts: ['.monkeycode-ai.live']
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
})
