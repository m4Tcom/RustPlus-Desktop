import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer lives in ./src with index.html at project root.
// base: './' so the built assets load with relative paths inside Electron (file://).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
