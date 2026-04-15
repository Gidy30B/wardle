import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function resolveBackendUrl(env: Record<string, string>) {
  return env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || env.VITE_API_URL
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendUrl = resolveBackendUrl(env)

  if (command === 'serve' && !backendUrl) {
    throw new Error('Missing VITE_BACKEND_URL, VITE_API_BASE_URL, or VITE_API_URL')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: backendUrl
      ? {
          host: true,
          proxy: {
            '/api/dashboard': {
              target: backendUrl,
              changeOrigin: true,
              rewrite: () => '/api/analytics/dashboard',
            },
            '/api/attempts-over-time': {
              target: backendUrl,
              changeOrigin: true,
              rewrite: () => '/api/analytics/attempts-over-time',
            },
            '/api': {
              target: backendUrl,
              changeOrigin: true,
            },
          },
        }
      : {
          host: true,
        },
  }
})
