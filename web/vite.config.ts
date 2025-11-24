import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use default base (/) so build rewrites entry script correctly
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
