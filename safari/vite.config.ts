import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

/**
 * Base Vite config for Safari extension.
 * NOT used directly — build.mjs imports pieces from this or uses
 * Vite's programmatic API with inline configs. This file exists for
 * IDE support (TypeScript intellisense, Tailwind CSS tooling).
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared/src'),
    },
    dedupe: [
      'i18next',
      'react-i18next',
      'i18next-browser-languagedetector',
      'react',
      'react-dom',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
