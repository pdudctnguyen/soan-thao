import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// Trình chiếu: build thành dist/trinh-chieu/index.html (một tệp duy nhất)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: '../dist/trinh-chieu', emptyOutDir: true, chunkSizeWarningLimit: 8000 },
})
