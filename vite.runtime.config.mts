import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Standalone game runtime: a single dependency-free IIFE bundle + CSS that is
// copied into every exported game (Windows, Web, and future mobile wrappers).
export default defineConfig({
  build: {
    outDir: resolve(import.meta.dirname, 'dist/runtime'),
    emptyOutDir: true,
    target: 'es2020',
    lib: {
      entry: resolve(import.meta.dirname, 'src/runtime/entry.ts'),
      name: 'TSTVNRuntime',
      formats: ['iife'],
      fileName: () => 'runtime.js',
      cssFileName: 'runtime',
    },
  },
});
