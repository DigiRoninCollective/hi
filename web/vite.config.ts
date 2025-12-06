import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        // Shim missing KmsUserRole export until upstream publishes it
        find: /^@phantom\/openapi-wallet-service$/,
        replacement: path.resolve(__dirname, 'src/shims/phantom-openapi-wallet-service.ts'),
      },
    ],
  },
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
