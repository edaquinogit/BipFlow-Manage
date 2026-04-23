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
  }
})
