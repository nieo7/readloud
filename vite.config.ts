import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['5173-ikpyachboawfvdfaaovax-e977a5f7.sg1.manus.computer', 'localhost', '127.0.0.1'],
  },
  base: '/readloud/',  // ← 改成你的 GitHub repo 名稱
})
