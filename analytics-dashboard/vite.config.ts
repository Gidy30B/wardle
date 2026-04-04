import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendUrl = env.VITE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Missing VITE_BACKEND_URL')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      proxy: {
        '/analytics': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
