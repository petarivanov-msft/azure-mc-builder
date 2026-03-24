import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/azure-mc-builder/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@fluentui')) return 'vendor-fluent';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('jszip') || id.includes('uuid') || id.includes('zustand') || id.includes('file-saver')) return 'vendor-utils';
          }
        },
      },
    },
  },
})
