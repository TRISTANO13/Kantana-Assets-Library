// web/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host : true,
    port : 8003,
    proxy: {
      '/api':  'http://localhost:5174',
      '/files':'http://localhost:5174'
    },
    allowedHosts: [
      'tools.cg.kantana.co.th'
    ]   
  }
})
