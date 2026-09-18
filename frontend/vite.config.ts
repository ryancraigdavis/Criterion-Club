import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_PROXY = { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8100' }

export default defineConfig({
  plugins: [react()],
  server: { port: 5273, proxy: API_PROXY },
  preview: { port: 4273, proxy: API_PROXY },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
