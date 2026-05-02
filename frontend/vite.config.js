import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

  // https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf': ['react-pdf', 'pdfjs-dist'],
          'dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
