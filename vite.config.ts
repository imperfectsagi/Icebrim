import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/react-router-dom|\/react\/|\/react-dom\//.test(id)) return 'react-vendor';
            if (id.includes('@tanstack/react-query')) return 'query-vendor';
            if (/react-hook-form|@hookform|\/zod\//.test(id)) return 'form-vendor';
          }
          return undefined;
        },
      },
    },
  },
})