import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    proxy: {
      '/ollama-cloud-api': {
        target: 'https://ollama.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-cloud-api/, ''),
        timeout: 600000,
        proxyTimeout: 600000
      }
    }
  }
})
