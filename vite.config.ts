import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'mcqgenerator.local',
    port: 80,
    proxy: {
      '/ollama-cloud-api': {
        target: 'https://ollama.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-cloud-api/, '')
      }
    }
  }
})
