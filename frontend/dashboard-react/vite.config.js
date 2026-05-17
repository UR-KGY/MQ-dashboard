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
      // 새로 추가할 백엔드 API 프록시 설정
      '/api/config': {
        target: 'http://localhost:8080', // Spring Boot 애플리케이션의 기본 포트
        changeOrigin: true,
        // '/api/config'를 제거하지 않고 백엔드에 전달합니다. (백엔드 엔드포인트가 /api/config로 시작하므로)
      },
    },
  },
})