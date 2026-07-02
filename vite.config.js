import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/worker': {
        target: 'https://market.electronmailbag.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/worker/, ''),
      }
    }
  }
})
