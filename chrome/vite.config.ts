import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
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
    sourcemap: true,
  },
});
