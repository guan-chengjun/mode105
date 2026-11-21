import { defineConfig } from 'vite';

// Vite 配置：纯前端 Three.js 工程，无需特殊插件
export default defineConfig({
  server: {
    port: 5173,
    open: true,
    host: '127.0.0.1'
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 1500
  }
});
