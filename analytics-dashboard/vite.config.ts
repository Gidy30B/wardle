import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = env.VITE_API_URL

  if (command === 'serve' && !apiUrl) {
    throw new Error('Missing VITE_API_URL')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: apiUrl
      ? {
          host: true,
          proxy: {
            '/api/dashboard': {
              target: apiUrl,
              changeOrigin: true,
              rewrite: () => '/api/analytics/dashboard',
            },
            '/api/attempts-over-time': {
              target: apiUrl,
              changeOrigin: true,
              rewrite: () => '/api/analytics/attempts-over-time',
            },
            '/api': {
              target: apiUrl,
              changeOrigin: true,
            },
          },
        }
      : {
          host: true,
        },
  }
})
