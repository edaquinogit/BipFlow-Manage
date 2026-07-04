import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    watch: {
      // Windows + WSL on /mnt/c can miss file events and keep stale Vue modules.
      usePolling: true,
      interval: 300,
    },
    headers: {
      'Cache-Control': 'no-store',
    },
    // Proxies API/media calls to the Django dev server through this same
    // origin. Without this, VITE_API_URL has to be an absolute
    // http://localhost:8000/... URL -- which only resolves when the browser
    // and Django run on the same machine. Opening the site from a phone on
    // the same Wi-Fi (via --host 0.0.0.0's LAN address) makes "localhost"
    // resolve to the phone itself, so every request fails with
    // ERR_CONNECTION_REFUSED. Proxying keeps the browser on one origin
    // (whatever host it used to reach Vite) and forwards server-to-server,
    // the same topology docker-compose.prod.yml already uses in production.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/admin': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  }
})
