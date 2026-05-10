import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // 프론트에서 호출하는 '/api/prometheus'를 가로챕니다.
      '/api/prometheus': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        // 중요: 주소의 앞부분인 '/api/prometheus'를 제거하고 프로메테우스에 전달합니다.
        rewrite: (path) => path.replace(/^\/api\/prometheus/, ''),
      },
    },
  },
})