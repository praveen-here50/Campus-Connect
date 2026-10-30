import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs on :8080 (or the `backend` container); the proxy keeps calls same-origin.
const target = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API only allows the :5173 origin, so fail loudly rather than move to 5174 and get 403s.
    port: 5173,
    strictPort: true,
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': target,
      '/ws': { target: target.replace(/^http/, 'ws'), ws: true },
    },
  },
})
