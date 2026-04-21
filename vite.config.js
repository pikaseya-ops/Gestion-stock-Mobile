import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3017',
        changeOrigin: true,
        ws: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src')
    }
  }
});
