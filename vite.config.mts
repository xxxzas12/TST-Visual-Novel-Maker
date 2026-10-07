import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Editor renderer build. Two pages: the editor itself and the preview page
// (an isolated iframe that hosts the game runtime).
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/editor'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist/editor'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'src/editor/index.html'),
        preview: resolve(import.meta.dirname, 'src/editor/preview.html'),
      },
    },
  },
  server: {
    port: 5183,
    strictPort: true,
  },
});
