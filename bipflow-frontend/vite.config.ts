import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const normalizeProxyTarget = (value: string) => value.replace(/\/+$/, '')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = normalizeProxyTarget(
    env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'
  )

  const backendProxy = { target: devProxyTarget, changeOrigin: false }

  return {
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
      // Proxies API/media calls through this same origin. By default it points
      // to the Django dev server at :8000; when using Docker/Compose, set
      // VITE_DEV_PROXY_TARGET to the frontend/Nginx public URL, for example
      // http://localhost:18088 in smoke runs.
      proxy: {
        '/api': backendProxy,
        '/admin': backendProxy,
        '/media': backendProxy,
        '/static': backendProxy,
      },
    }
  }
})
