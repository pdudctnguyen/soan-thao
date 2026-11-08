import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// Bảng tính: build thành dist/bang-tinh/index.html (một tệp duy nhất)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: '../dist/bang-tinh', emptyOutDir: true, chunkSizeWarningLimit: 8000 },
})
